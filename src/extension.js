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
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, assert, Settings } = Me.imports.library;
const MConnect = Me.imports.mconnect;


const StatusBar = new Lang.Class({
    Name: "StatusBar",
    Extends: PopupMenu.PopupMenuSection,

    _init: function (device) {
        this.parent();
        this.actor.style_class = "mconnect-status-bar";
        
        //
        this.statusLabel = new St.Label({
            text: "",
            style_class: "mconnect-status-label"
        });
        this.statusLabel.clutter_text.line_wrap = true;
        this.actor.add(this.statusLabel);
        
        // Connection Properties
        this.propertyBox = new St.BoxLayout({
            vertical: false,
            style_class: "popup-sub-menu"
        });
        this.propertyBox.add_style_class_name("mconnect-property-box");
        this.actor.add(this.propertyBox, { expand: true });
        
        let nameBox = new St.BoxLayout({
            vertical: true,
            style_class: "mconnect-property-name"
        });
        this.propertyBox.add(nameBox);
        
        let valueBox = new St.BoxLayout({
            vertical: true,
            style_class: "mconnect-property-value"
        });
        this.propertyBox.add(valueBox);
        
        nameBox.add(new St.Label({ text: _("Address") }));
        valueBox.add(new St.Label({ text: device.address }));
        
        nameBox.add(new St.Label({ text: _("Type") }));
        valueBox.add(new St.Label({ text: device.type }));
        
        nameBox.add(new St.Label({ text: _("Id") }));
        valueBox.add(new St.Label({ text: device.id }));
        
        // TODO: MConnect only offers the "old" encryption method currently
        nameBox.add(new St.Label({ text: _("Encryption") }));
        valueBox.add(new St.Label({ text: _("RSA private-key") }));
        
        // Pair Button
        this.pairItem = new PopupMenu.PopupMenuItem("pair button")
        this.pairItem.label.x_expand = true;
        this.pairItem.label.x_align = Clutter.ActorAlign.CENTER;
        this.addMenuItem(this.pairItem);
    }
});

// A PopupMenu used as an information and control center for a device,
// accessible either as a User Menu submenu or Indicator popup-menu.
const DeviceMenu = new Lang.Class({
    Name: "DeviceMenu",
    Extends: PopupMenu.PopupMenuSection,

    _init: function (device) {
        this.parent(null, "DeviceMenu");

        this.device = device;

        // Info Bar
        this.infoBar = new PopupMenu.PopupSeparatorMenuItem(device.name);
        this.infoBar.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.addMenuItem(this.infoBar);
        
        // InfoBar -> Battery label (eg. "85%")
        this.batteryLabel = new St.Label();
        this.batteryLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.infoBar.actor.add(this.batteryLabel);
        
        // Info Bar -> Battery Icon (eg. battery-good-symbolic)
        this.batteryIcon = new St.Icon({
            icon_name: "battery-missing-symbolic",
            style_class: "popup-menu-icon"
        });
        this.infoBar.actor.add(this.batteryIcon);
        
        // Pairing Bar
        this.statusBar = new StatusBar(device)
        this.statusBar.pairItem.connect("activate", () => {
            this.emit("toggle::allowed", device.gObjectPath);
        });
        this.addMenuItem(this.statusBar);

        // Action Bar
        this.actionBar = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false
        }); 
        this.addMenuItem(this.actionBar);

        this.smsButton = this._addActionButton(
            "user-available-symbolic",
            Lang.bind(this, this._smsAction)
        );
        this.findButton = this._addActionButton(
            "find-location-symbolic",
            Lang.bind(this, this._findAction)
        );
        this.browseButton = this._addActionButton(
            "folder-remote-symbolic",
            Lang.bind(this, this._browseAction)
        );
        this.shareButton = this._addActionButton(
            "send-to-symbolic",
            Lang.bind(this, this._shareAction)
        );

        // Property signals
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
        // TODO: MConnect doesn't call PropertiesChanged on cached devices?
        this._stateChanged(device);
        
        // Settings
        ["show-offline", "show-unpaired"].forEach((setting) => {
            Settings.connect(
                "changed::" + setting,
                Lang.bind(this, this._settingsChanged)
            )
        });
        this._settingsChanged();
    },

    _addActionButton: function (name, callback) {
        let button = new St.Button({ style_class: "system-menu-action" });
        button.child = new St.Icon({ icon_name: name });

        button.style = "padding: 8px;";
        
        if (callback) { button.connect("clicked", callback); }

        this.actionBar.actor.add(button, { expand: true, x_fill: false });
        
        return button;
    },

    // Callbacks
    _batteryChanged: function (device, variant) {
        debug("extension.DeviceMenu._batteryChanged(" + variant.deep_unpack() + ")");
        
        let [charging, level] = variant.deep_unpack();
        let icon = "battery";

        if (level < 3) {
            icon += charging ? "-empty-charging" : "-empty";
        } else if (level < 10) {
            icon += charging ? "-caution-charging" : "-caution";
        } else if (level < 30) {
            icon += charging ? "-low-charging" : "-low";
        } else if (level < 60) {
            icon += charging ? "-good-charging" : "-good";
        } else if (level >= 60) {
            icon += charging ? "-full-charging" : "-full";
        }

        this.batteryIcon.icon_name = icon + "-symbolic";
        this.batteryLabel.text = level + "%";
    },

    _nameChanged: function (device, name) {
        debug("extension.DeviceMenu._nameChanged()");
        
        name = name.deep_unpack();
        this.nameLabel.label.text = (name === "string") ? name : device.name;
    },

    _pluginsChanged: function (device, plugins) {
        // TODO: mconnect.js loads plugins when device.active (because that's
        //       when MConnect does), but plugins aren't usable until
        //       device.connected (allowed, paired and reachable)
        debug("extension.DeviceMenu._pluginsChanged()");

        // Device Menu Buttons
        let buttons = {
            browse: this.browseButton,
            findmyphone: this.findButton,
            share: this.shareButton,
            sms: this.smsButton
        };
        let sensitive;

        for (let name in buttons) {
            sensitive = (device.hasOwnProperty(name));
            buttons[name].can_focus = sensitive;
            buttons[name].reactive = sensitive;
            buttons[name].track_hover = sensitive;
            buttons[name].opacity = sensitive ? 255 : 128;
        }
        
        // Battery plugin disabled/unallowed
        if (!device.paired) {
            this.batteryIcon.visible = false;
            this.batteryLabel.text = "";
            return;
        } else if (!device.hasOwnProperty("battery")) {
            this.batteryIcon.icon_name = "battery-missing-symbolic";
            this.batteryLabel.text = "";
            return;
        }
        
        this._batteryChanged(
            device,
            new GLib.Variant(
                "(bu)",
                [device.battery.charging, device.battery.level]
            )
        );
    },

    _settingsChanged: function () {
        // FIXME: kind of confusing settings
        debug("extension.DeviceMenu._settingsChanged()");

        // Show unallowed
        if (Settings.get_boolean("show-unpaired")) {
            this.actor.visible = true;
        } else {
            this.actor.visible = (this.device.allowed === true && this.device.paired === true);
        }
        
        // Show offline
        if (Settings.get_boolean("show-offline")) {
            this.actor.visible = true;
        } else {
            this.actor.visible = (this.device.active === true);
        }
    },

    _stateChanged: function (device, state) {
        debug("extension.DeviceMenu._stateChanged(" + device.gObjectPath + ")");

        // Not "Connected" or "Active" (Device is unreachable)
        if (!device.connected === true || !device.active === true) {
            this.actionBar.actor.visible = false;
            this.statusBar.actor.visible = true;
            
            this.statusBar.statusLabel.text = _("Device is offline");
            this.statusBar.propertyBox.visible = false;
            this.statusBar.pairItem.actor.visible = false;
        // Not "Allowed" (Pair request has not been sent yet)
        } else if (!device.allowed === true) {
            this.actionBar.actor.visible = false;
            this.statusBar.actor.visible = true;
            
            this.statusBar.statusLabel.text = _("This device is unpaired");
            this.statusBar.propertyBox.visible = true;
            this.statusBar.pairItem.actor.visible = true;
            this.statusBar.pairItem.label.text = _("Send pair request");
        // Not "Paired" (Device has not accepted pair request)
        } else if (!device.paired === true) {
            this.actionBar.actor.visible = false;
            this.statusBar.actor.visible = true;
            
            this.statusBar.statusLabel.text = _("A pair request is in progress for this device");
            this.statusBar.propertyBox.visible = true;
            this.statusBar.pairItem.actor.visible = true;
            this.statusBar.pairItem.label.text = _("Cancel pair request");
        // "Connected", "Active", "Paired" and "Allowed" (Good to go)
        } else {
            this.actionBar.actor.visible = true;
            this.statusBar.actor.visible = false;
        }
        
        this._pluginsChanged(device);
    },

    // Plugin Callbacks
    _browseAction: function (button) {
        debug("extension.DeviceMenu._browseAction(): Not Implemented");
        
        this._unsupportedAction();
        this._getTopMenu().close(true);
    },

    _findAction: function (button) {
        debug("extension.DeviceMenu._findAction(): Not Implemented");
        
        this._unsupportedAction();
        this._getTopMenu().close(true);
    },

    _shareAction: function (button) {
        debug("extension.DeviceMenu._shareAction()");
        
        this._getTopMenu().close(true);
        
        let dialog = new Me.imports.library.FileChooserDialog({
            message_type: Gtk.MessageType.INFO,
            text: _("Send file..."),
            secondary_text: _("Select a file to send."),
            buttons: Gtk.ButtonsType.OK_CANCEL
        });

        dialog.connect("response", () => { dialog.close(); });
        dialog.open();
    },

    _smsAction: function (button) {
        // TODO: Shell.EmbeddedWindow
        debug("extension.DeviceMenu._smsAction(): Not Implemented");
        
        this._unsupportedAction();
        this._getTopMenu().close(true);
    },
    
    _unsupportedAction: function () {
        // TODO: just a placeholder function
        let dialog = new Me.imports.library.MessageDialog({
            message_type: Gtk.MessageType.INFO,
            text: _("Unsupported Feature"),
            secondary_text: _("Sorry, this feature is not yet supported."),
            buttons: Gtk.ButtonsType.OK
        });

        dialog.connect("response", () => { dialog.close(); });
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
        let sets = ["device-indicators", "show-offline", "show-unpaired"];
        sets.forEach((setting) => {
            Settings.connect("changed::" + setting, () => { this._sync(); });
        });
        
        ["active", "allowed", "connected", "paired"].forEach((property) => {
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
        if (Settings.get_boolean("show-unpaired")) {
            this.actor.visible = true;
        } else {
            this.actor.visible = (this.device.allowed === true);
        }

        // Indicator Visibility (User Setting)
        if (this.actor.visible) {
            this.actor.visible = Settings.get_boolean("device-indicators");
        }

        // Indicator Icon
        let icon = this.device.type;
        icon = (icon === "phone") ? "smartphone" : icon;

        if (this.device.connected === true && this.device.paired === true) {
            this.icon.icon_name = icon + "-connected";
        } else if (this.device.allowed === true) {
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
        this.extensionMenu = new PopupMenu.PopupSubMenuMenuItem(
            _("Mobile Devices"),
            true
        );
        this.extensionMenu.icon.icon_name = "smartphone-symbolic";
        this.menu.addMenuItem(this.extensionMenu);

        // Extension Menu -> Devices Section -> [ DeviceMenu, ... ]
        this.devicesSection = new PopupMenu.PopupMenuSection();
        this.extensionMenu.menu.addMenuItem(this.devicesSection);

        // Extension Menu -> [ Enable Item ]
        this.enableItem = this.extensionMenu.menu.addAction(
            _("Enable"),
            MConnect.startDaemon
        );

        // Extension Menu -> Mobile Settings Item
        this.extensionMenu.menu.addAction(
            _("Mobile Settings"),
            MConnect.startPreferences
        );

        //
        Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this.menu, 4);

        // Watch "device-indicators" setting
        Settings.connect(
            "changed::device-indicators",
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

        // Watch "start-mconnect" setting
        Settings.connect("changed::start-mconnect", (settings, key) => {
            debug("Settings: changed::start-mconnect");

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
        if (Settings.get_boolean("device-indicators")) {
            this.devicesSection.actor.visible = false;
        } else {
            this.devicesSection.actor.visible = true;
        }
    },

    _toggleAllowed: function (menu, dbusPath) {
        debug("extension.SystemIndicator._toggleAllowed(" + dbusPath + ")");

        let device = this.manager.devices[dbusPath];

        if (device.paired || device.allowed) {
            this.manager.disallowDevice(dbusPath);
        } else {
            this.manager.allowDevice(dbusPath);
        }
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

        // If a manager is initialized, destroy it
        if (this.manager) {
            this.manager.destroy();
            this.manager = null;
        }

        // Sync the UI
        this._sync();

        // Start the daemon or wait for it to start
        if (Settings.get_boolean("start-mconnect")) {
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
            Lang.bind(this, this._toggleAllowed)
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

        // Stop watching "start-mconnect" & DBus
        // TODO: instance '0x55ff988e3920' has no handler with id '9223372036854775808'
        //Settings.disconnect("changed::start-mconnect");

        // Stop watching for DBus Service
        Gio.bus_unwatch_name(this._watchdog);
    }
});

// FIXME: not supposed to mix "let" and "var" but "const" doesn't hold
var systemIndicator;

function init() {
    debug("initializing extension");
    
    Me.imports.library.initTranslations();
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
