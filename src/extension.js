"use strict";

// Imports
const Gettext = imports.gettext.domain('gnome-shell-extension-mconnect');
const _ = Gettext.gettext;
const Lang = imports.lang;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, assert, Settings } = Me.imports.lib;
const MConnect = Me.imports.mconnect;
const Sw = Me.imports.Sw;


// A PopupMenu used as an information and control center for a device,
// accessible either as a User Menu submenu or Indicator popup-menu.
const DeviceMenu = new Lang.Class({
    Name: "DeviceMenu",
    Extends: PopupMenu.PopupMenuSection,

    _init: function (device) {
        this.parent(null, "DeviceMenu");

        this.device = device;

        // Menu Items -> Info Bar
        this.infoBar = new PopupMenu.PopupSeparatorMenuItem(device.name);
        this.addMenuItem(this.infoBar);
        // Menu Items -> InfoBar -> Battery label (eg. "85%")
        this.batteryLabel = new St.Label();
        this.infoBar.actor.add(this.batteryLabel);
        // Menu Items -> Info Bar -> Battery Icon (eg. battery-good-symbolic)
        this.batteryButton = this._createButton(
            "status",
            "battery-missing-symbolic",
            this._batteryAction
        );
        this.infoBar.actor.add(this.batteryButton);
        // Menu Items -> Info Bar -> Allow Icon
        this.allowButton = this._createButton(
            "status",
            "channel-insecure-symbolic",
            this._allowAction
        );
        this.infoBar.actor.add(this.allowButton);

        // Menu Items -> Action Bar
        this.actionBar = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        });
        this.addMenuItem(this.actionBar);

        // Menu Items -> Action Bar -> Send SMS Action
        this.smsButton = this._createButton(
            "action",
            "user-available-symbolic",
            this._smsAction
        );
        this.actionBar.actor.add(this.smsButton, { expand: true, x_fill: false });

        // Menu Items -> Action Bar -> Find my phone Action
        this.findButton = this._createButton(
            "action",
            "find-location-symbolic",
            this._findAction
        );
        this.actionBar.actor.add(this.findButton, { expand: true, x_fill: false });

        // Connect to "Device.changed::*" signals
        device.connect(
            "changed::battery",
            Lang.bind(this, this._batteryChanged)
        );
        device.connect(
            "changed::name", 
            Lang.bind(this, this._nameChanged)
        );
        device.connect(
            "changed::plugins",
            Lang.bind(this, this._pluginsChanged)
        );
        
        // Status Properties
        ["active", "allowed", "connected", "paired"].forEach((property) => {
            device.connect(
                "changed::" + property,
                Lang.bind(this, this._stateChanged)
            );
        });
        
        Settings.connect(
            "changed::show-offline",
            Lang.bind(this, this._settingsChanged)
        );
        Settings.connect(
            "changed::show-unallowed",
            Lang.bind(this, this._settingsChanged)
        );

        this._batteryAction();
        this._pluginsChanged(device);
        
        this._settingsChanged();
    },

    _createButton: function (type, name, callback) {
        let button = new St.Button();
            button.child = new St.Icon({ icon_name: name });

        if (type === "action") {
            button.style_class = "system-menu-action";
            button.style = "padding: 8px; border-radius: 24px;";
        } else if (type === "status") {
            button.child.style_class = "popup-menu-icon";
        }

        if (callback) { button.connect("clicked", Lang.bind(this, callback)); }

        return button;
    },

    // Callbacks
    _batteryChanged: function (device, charging, level) {
        debug("extension.DeviceMenu._batteryChanged(" + [level, charging] + ")");

        // Battery plugin disabled/unallowed
        if (!device.hasOwnProperty("battery") || !device.connected) {
            this.batteryButton.child.icon_name = "battery-missing-symbolic";
            this.batteryLabel.text = "";
            return;
        }
        
        // Try the get data from the device itself
        if (!(typeof level === "number") || !(typeof charging === "boolean")) {
            level = device.battery.level;
            charging = device.battery.charging;
        }
        
        // uPower Style
        let icon = "battery";

        if (level < 3) {
            icon += charging === true ? "-empty-charging" : "-empty";
        } else if (level < 10) {
            icon += charging === true ? "-caution-charging" : "-caution";
        } else if (level < 30) {
            icon += charging === true ? "-low-charging" : "-low";
        } else if (level < 60) {
            icon += charging === true ? "-good-charging" : "-good";
        } else if (level >= 60) {
            icon += charging === true ? "-full-charging" : "-full";
        }

        this.batteryButton.child.icon_name = icon + "-symbolic";
        this.batteryLabel.text = level + "%";
    },

    _nameChanged: function (device, name) {
        debug("extension.DeviceMenu._nameChanged()");
        
        name = name.deep_unpack();
        this.infoBar.label.text = (name === "string") ? name : device.name;
    },

    _pluginsChanged: function (device, plugins) {
        // TODO: mconnect.js loads plugins when device.active (because that's
        //       when MConnect does), but plugins aren't usable until
        //       device.connected (allowed, paired and reachable)
        debug("extension.DeviceMenu._pluginsChanged()");

        // Device Menu Buttons
        let buttons = { findmyphone: this.findButton, sms: this.smsButton };
        let sensitive;

        for (let name in buttons) {
            sensitive = (device.hasOwnProperty(name) && device.connected);
            buttons[name].can_focus = sensitive;
            buttons[name].reactive = sensitive;
            buttons[name].track_hover = sensitive;
            buttons[name].opacity = sensitive ? 255 : 128;
        }
    },

    _settingsChanged: function () {
        debug("extension.DeviceMenu._settingsChanged()");

        // Show unallowed
        if (Settings.get_boolean("show-unallowed")) {
            this.actor.visible = true;
        } else {
            this.actor.visible = this.device.allowed;
        }
        
        // Show offline
        if (Settings.get_boolean("show-offline")) {
            this.actor.visible = true;
        } else {
            this.actor.visible = this.device.active;
        }
    },

    _stateChanged: function (device, state) {
        debug("extension.DeviceMenu._stateChanged(" + device.gObjectPath + ")");

        if (device.connected) {
            this.allowButton.child.icon_name = "channel-secure-symbolic";
        } else if (device.allowed) {
            this.allowButton.child.icon_name = "feed-refresh-symbolic";
        } else {
            this.allowButton.child.icon_name = "channel-insecure-symbolic";
        }
        
        this._pluginsChanged(device);
    },

    // Action Button Callbacks
    _allowAction: function () {
        debug("extension.DeviceMenu._allowAction()");

        // allowDevice() is a DeviceManager method so kick this up the chain
        this.emit("toggle::allowed", this.device.gObjectPath);
        this._getTopMenu().close(true);
    },
    
    _batteryAction: function (button) {
        debug("extension.DeviceMenu._batteryAction()");
        
        if (!this.device.hasOwnProperty("battery")) { return };
        
        this._batteryChanged(
            this.device,
            this.device.battery.charging,
            this.device.battery.level
        );
    },

    _findAction: function (button) {
        debug("extension.DeviceMenu._findAction()");
        
        let dialog = new Sw.MessageDialog({
            message_type: Sw.MessageType.INFO,
            text: "Unsupported Feature",
            secondary_text: "Sorry, Find My Phone is not yet supported.",
            buttons: Sw.ButtonsType.OK
        });

        dialog.connect("response", (dialog, responseType) => {
            dialog.close();
            
            if (responseType === Sw.ResponseType.OK) {
                this.device.ring();
            }
        });

        dialog.open();

        this._getTopMenu().close(true);
    },

    _smsAction: function (button) {
        // TODO: Shell.EmbeddedWindow
        debug("extension.DeviceMenu._sms()");
        
        let dialog = new Sw.MessageDialog({
            message_type: Sw.MessageType.INFO,
            text: "Unsupported Feature",
            secondary_text: "Sorry, sending SMS messages is not yet supported.",
            buttons: Sw.ButtonsType.OK
        });

        dialog.connect("response", (dialog, responseType) => {
            dialog.close();
            
            if (responseType === Sw.ResponseType.YES) {
                this.device.send(dbusPath);
            }
        });

        dialog.open();

        this._getTopMenu().close(true);
    }
});

Signals.addSignalMethods(DeviceMenu.prototype);

// An indicator representing a device in Menu.panel.statusArea, used as an
// optional location for a DeviceMenu.
const DeviceIndicator = new Lang.Class({
    Name: "DeviceIndicator",
    Extends: PanelMenu.Button,

    _init: function (device) {
        this.parent(null, device.name + " Indicator", false);

        this.device = device;

        // Device Icon
        this.icon = new St.Icon({
            icon_name: "smartphone-disconnected",
            style_class: "system-status-icon"
        });
        this.actor.add_actor(this.icon);

        this.deviceMenu = new DeviceMenu(device);
        this.menu.addMenuItem(this.deviceMenu);

        // Signals
        this._setSignals = [];
        
        let sets = ["per-device-indicators", "show-offline", "show-unallowed"];
        sets.forEach((setting) => {
            Settings.connect("changed::" + setting, () => { this._sync(); });
        });
        
        ["active", "allowed", "connected"].forEach((property) => {
            device.connect("changed::" + property, () => { this._sync(); });
        });

        // Sync
        this._sync(device);
    },

    // Callbacks
    _sync: function (sender, cb_data) {
        debug("extension.DeviceIndicator._sync()");

        // Device Visibility
        // TODO
        if (!Settings.get_boolean("show-unallowed")) {
            this.actor.visible = this.device.allowed;
        } else {
            this.actor.visible = true;
        }

        // Indicator Visibility (User Setting)
        if (this.actor.visible) {
            this.actor.visible = Settings.get_boolean("per-device-indicators");
        }

        // Indicator Icon
        let icon = this.device.type;

        if (this.device.type === "phone") {
            icon = "smartphone";
        }

        if (this.device.connected) {
            this.icon.icon_name = icon + "-connected";
        } else if (this.device.allowed) {
            this.icon.icon_name = icon + "-trusted";
        } else {
            this.icon.icon_name = icon + "-disconnected";
        }
    },
    
    destroy: function () {
        this.deviceMenu.destroy();
        delete this.deviceMenu;
        PanelMenu.Button.prototype.destroy.call(this);
    }
});

// The main extension hub.
const SystemIndicator = new Lang.Class({
    Name: "SystemIndicator",
    Extends: PanelMenu.SystemIndicator,

    _init: function () {
        this.parent();

        this.manager = null;

        // device submenus
        this.deviceMenus = {};

        // System Indicator
        this.extensionIndicator = this._addIndicator();
        this.extensionIndicator.icon_name = "smartphone-symbolic";
        let userMenuTray = Main.panel.statusArea.aggregateMenu._indicators;
        userMenuTray.insert_child_at_index(this.indicators, 0);

        // Extension Menu
        this.extensionMenu = new PopupMenu.PopupSubMenuMenuItem("Mobile Devices", true);
        this.extensionMenu.icon.icon_name = "smartphone-symbolic";
        this.menu.addMenuItem(this.extensionMenu);

        // Extension Menu -> Devices Section -> [ DeviceMenu, ... ]
        this.devicesSection = new PopupMenu.PopupMenuSection();
        this.extensionMenu.menu.addMenuItem(this.devicesSection);

        // Extension Menu -> [ Enable Item ]
        this.enableItem = this.extensionMenu.menu.addAction(
            "Enable",
            MConnect.startDaemon
        );

        // Extension Menu -> Mobile Settings Item
        this.extensionMenu.menu.addAction(
            "Mobile Settings",
            MConnect.startPreferences
        );

        //
        Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this.menu, 4);

        // Watch "per-device-indicators" setting
        Settings.connect(
            "changed::per-device-indicators",
            Lang.bind(this, this._sync)
        );

        // Watch for DBus service
        this._watchdog = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            MConnect.BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            Lang.bind(this, this._daemonAppeared),
            Lang.bind(this, this._daemonVanished)
        );

        // Watch "start-daemon" setting
        Settings.connect("changed::start-daemon", (settings, key) => {
            debug("Settings: changed::start-daemon");

            if (Settings.get_boolean(key) && this.manager === null) {
                MConnect.startDaemon();
            }
        });
    },

    // UI Settings callbacks
    _sync: function () {
        debug("extension.SystemIndicator._sync()");

        // Show "Enable" if backend not running
        this.enableItem.actor.visible = (this.manager) ? false : true;

        // Show per-device indicators OR user menu entries
        if (Settings.get_boolean("per-device-indicators")) {
            this.devicesSection.actor.visible = false;
        } else {
            this.devicesSection.actor.visible = true;
        }
    },

    _toggleAllowed: function (menu, dbusPath) {
        debug("extension.SystemIndicator._toggleAllowed(" + dbusPath + ")");

        let device = this.manager.devices[dbusPath];
        let action, params;

        // Prepare the dialog content
        if (device.paired) {
            params = {
                message_type: Sw.MessageType.QUESTION,
                icon_name: "channel-insecure-symbolic",
                text: "Disallow the " + device.type + " \"" + device.name + "\"",
                secondary_text: _("Disallowing this device will deny it access to your computer."),
                buttons: [
                    {text: "Cancel", response: Sw.ResponseType.CANCEL,
                    isDefault: false, key: Clutter.KEY_Escape},
                    {text: "Disallow", response: 1, isDefault: true}
                ]
            };

            action = Lang.bind(this.manager, this.manager.disallowDevice);
        } else if (device.allowed) {
            params = {
                message_type: Sw.MessageType.QUESTION,
                icon_name: "feed-refresh-symbolic",
                text: "Disallow the " + device.type + " \"" + device.name + "\"",
                secondary_text: _("A pairing request is currently in progress. Disallowing this device will cancel the request and deny it access to your computer."),
                buttons: [
                    {text: "Cancel", response: Sw.ResponseType.CANCEL,
                    isDefault: false, key: Clutter.KEY_Escape},
                    {text: "Disallow", response: 1, isDefault: true}
                ]
            };

            action = Lang.bind(this.manager, this.manager.disallowDevice);
        } else {
            params = {
                message_type: Sw.MessageType.QUESTION,
                icon_name: "channel-insecure-symbolic",
                text: "Allow the " + device.type + " \"" + device.name + "\"",
                secondary_text: _("Allowing this device will grant it access to your computer and may pose a serious security risk."),
                buttons: [
                    {text: "Cancel", response: Sw.ResponseType.CANCEL,
                    isDefault: false, key: Clutter.KEY_Escape},
                    {text: "Allow", response: 1, isDefault: true}
                ]
            };

            action = Lang.bind(this.manager, this.manager.allowDevice);
        }

        // Prompt the user with the dialog
        let prompt = new Sw.MessageDialog(params);

        prompt.connect("response", (dialog, responseType) => {
            prompt.close();
            
            if (responseType !== Sw.ResponseType.CANCEL) {
                action(dbusPath);
            }
        });

        prompt.open();
    },

    // DBus Callbacks
    _daemonAppeared: function (conn, name, name_owner, cb_data) {
        // The DBus interface has appeared
        debug("extension.SystemIndicator._daemonAppeared()");

        // Initialize the manager and add current devices
        this.manager = new MConnect.DeviceManager();

        for (let dbusPath in this.manager.devices) {
            systemIndicator._deviceAdded(this.manager, null, dbusPath);
        }

        // Sync the UI
        this._sync();

        // Watch for new and removed devices
        this.manager.connect(
            "device::added",
            Lang.bind(this, this._deviceAdded)
        );

        this.manager.connect(
            "device::removed",
            Lang.bind(this, this._deviceRemoved)
        );
    },

    _daemonVanished: function (conn, name, name_owner, cb_data) {
        // The DBus interface has vanished
        debug("extension.SystemIndicator._daemonVanished()");

        // Stop watching for new and remove devices
        // TODO: JS ERROR: Error: No signal connection device::added found
        //       JS ERROR: Error: No signal connection device::removed found
        //this.manager.disconnect("device::added");
        //this.manager.disconnect("device::removed");

        // If a manager is initialized, destroy it
        if (this.manager) {
            this.manager.destroy();
            this.manager = null;
        }

        // Sync the UI
        this._sync();

        // Start the daemon or wait for it to start
        if (Settings.get_boolean("start-daemon")) {
            MConnect.startDaemon();
        } else {
            log("waiting for daemon");
        }
    },

    _deviceAdded: function (manager, detail, dbusPath) {
        debug("extension.SystemIndicator._deviceAdded(" + dbusPath + ")");

        let device = this.manager.devices[dbusPath];

        // Per-device indicator
        let indicator = new DeviceIndicator(device);
        indicator.deviceMenu.connect(
            "toggle::allowed",
            Lang.bind(this, this._toggleAllowed)
        );
        Main.panel.addToStatusArea(dbusPath, indicator);

        // User menu entry
        this.deviceMenus[dbusPath] = new DeviceMenu(device);
        this.deviceMenus[dbusPath].connect(
            "toggle::allowed",
            Lang.bind(this.manager, this._toggleAllowed)
        );
        this.devicesSection.addMenuItem(this.deviceMenus[dbusPath]);
    },

    _deviceRemoved: function (manager, dbusPath) {
        // FIXME: not detail on device::removed?
        debug("extension.SystemIndicator._deviceRemoved(" + dbusPath + ")");
        
        // Per-device indicator
        Main.panel.statusArea[dbusPath].destroy();

        // User menu entry
        this.deviceMenus[dbusPath].destroy();
        delete this.deviceMenus[dbusPath]
    },

    // Public Methods
    destroy: function () {
        this.manager.destroy();
        delete this.manager;
        
        // There should be matching deviceMenus and deviceIndicators
        for (let dbusPath in this.deviceMenus) {
            // Indicators
            Main.panel.statusArea[dbusPath].destroy();
            // Menus
            this.deviceMenus[dbusPath].destroy();
            delete this.deviceMenus[dbusPath]
        }

        // Destroy the UI
        this.devicesSection.destroy();
        this.extensionMenu.destroy();
        this.extensionIndicator.destroy();
        this.menu.destroy();

        // Stop watching "start-daemon" & DBus
        // TODO: instance '0x55ff988e3920' has no handler with id '9223372036854775808'
        //Settings.disconnect("changed::start-daemon");

        // Stop watching for DBus Service
        Gio.bus_unwatch_name(this._watchdog);
    }
});

// FIXME: not supposed to mix "let" and "var" but "const" doesn't hold
var systemIndicator;

function init() {
    debug("initializing extension");
    
    Me.imports.lib.initTranslations();
}

function enable() {
    debug("enabling extension");

    // Create the UI
    systemIndicator = new SystemIndicator();
}

function disable() {
    debug("disabling extension");

    // Destroy the UI
    systemIndicator.destroy();
}
