"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { debug, Settings } = Me.imports.utils;
const Sw = Me.imports.Sw;


// An indicator representing a device in Menu.panel.statusArea, used as an
// optional location for a DeviceMenu.
const DeviceIndicator = new Lang.Class({
    Name: "DeviceIndicator",
    Extends: PanelMenu.Button,
    
    _init: function (device) {
        this.parent(null, "DeviceIndicator");
        
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
        device.connect("changed::active", () => { this._sync(); });
        device.connect("changed::trusted", () => { this._sync(); });
        
        Settings.connect("changed::per-device-indicators", () => { this._sync(); });
        Settings.connect("changed::show-offline", () => { this._sync(); });
        Settings.connect("changed::show-untrusted", () => { this._sync(); });
        
        // Sync
        this._sync(device);
    },
    
    // Callbacks
    _sync: function (sender, cb_data) {
        debug("extension.DeviceIndicator._sync()");
        
        // Device Visibility
        // TODO: this just isn't intuitive for the user at all
        if (!Settings.get_boolean("show-offline")) {
            this.actor.visible = this.device.active;
        } else if (!Settings.get_boolean("show-untrusted")) {
            this.actor.visible = this.device.trusted;
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
        
        if (this.device.active && this.device.trusted) {
            this.icon.icon_name = icon + "-connected";
        } else if (this.device.trusted) {
            this.icon.icon_name = icon + "-trusted";
        } else {
            this.icon.icon_name = icon + "-disconnected";
        }
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
        
        // Menu Items -> Info Bar
        // TODO: should be dynamic
        this.infoBar = new PopupMenu.PopupSeparatorMenuItem(device.name);
        this.addMenuItem(this.infoBar);
        // Menu Items -> Separator -> Battery label (eg. "85%")
        this.batteryLabel = new St.Label();
        this.infoBar.actor.add(this.batteryLabel);
        // Menu Items -> Separator -> Battery Icon (eg. battery-good-symbolic)
        this.batteryButton = this._createButton(
            "status",
            "battery-missing-symbolic",
            this._batteryChanged
        );
        this.infoBar.actor.add(this.batteryButton);
        // Menu Items -> Separator -> Trust Icon (eg. battery-good-symbolic)
        this.trustButton = this._createButton(
            "status",
            "channel-insecure-symbolic",
            this._trustAction
        );
        this.infoBar.actor.add(this.trustButton);
        
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
            this._findAction,
            device
        );
        this.actionBar.actor.add(this.findButton, { expand: true, x_fill: false });
        
        // Connect to "Device.changed::*" signals
        device.connect("changed::active", Lang.bind(this, this._activeChanged));
        device.connect("changed::battery", Lang.bind(this, this._batteryChanged));
        device.connect("changed::plugins", Lang.bind(this, this._pluginsChanged));
        device.connect("changed::trusted", Lang.bind(this, this._trustedChanged));
        
        Settings.connect("changed::show-offline", Lang.bind(this, this._sync));
        Settings.connect("changed::show-untrusted", Lang.bind(this, this._sync));
        
        this._sync(device);
    },
    
    _createButton: function (type, name, callback) {
        let button = new St.Button();
        button.child = new St.Icon({ icon_name: name });
        
        if (type === "status") {
            button.child.style_class = "popup-menu-icon";
        } else if (type === "action") {
            button.style_class = "system-menu-action";
            button.style = "padding: 8px; border-radius: 24px;";
        }
        
        if (callback) {
            button.connect("clicked", Lang.bind(this, callback));
        }
        
        return button;
    },
    
    // Callbacks
    _activeChanged: function (device, active) {
        debug("extension.DeviceMenu._activeChanged()");
        
        active = (active !== undefined) ? active : device.active;
        
        let buttons = [
            //this.batteryButton,
            this.smsButton,
            this.findButton,
            //this.trustButton
        ];
        
        if (active) {
            buttons.forEach((button) => {
                button.can_focus = true;
                button.reactive = true;
                button.track_hover = true;
                button.opacity = 255;
            });
        } else {
            buttons.forEach((button) => {
                button.can_focus = false;
                button.reactive = false;
                button.track_hover = false;
                button.opacity = 128;
            });
        }
    },
    
    _batteryChanged: function (device, levelState) {
        // Set the icon name, relevant to battery level and charging state
        debug("extension.DeviceMenu._batteryChanged(" + levelState + ")");
        
        device = (device.plugins !== undefined) ? device : this.device;
        
        debug("plugins: " + Object.keys(device.plugins));
        
        // Battery plugin disabled
        if (!device.plugins.hasOwnProperty("battery") || !device.trusted) {
            this.batteryButton.child.icon_name = "battery-missing-symbolic";
            this.batteryLabel.text = "";
            return;
        }
            debug("charge: " + device.plugins.battery.charge);
        
        // Try the get data from the device itself
        if (!levelState) {
            levelState = [
                this.device.plugins.battery.level,
                this.device.plugins.battery.charging
            ];
        }
        
        debug("levelState: " + levelState);
        
        // uPower Style
        let icon = "battery";
        
        if (levelState[0] < 3) {
            icon += levelState[1] === true ? "-empty-charging" : "-empty";
        } else if (levelState[0] < 10) {
            icon += levelState[1] === true ? "-caution-charging" : "-caution";
        } else if (levelState[0] < 30) {
            icon += levelState[1] === true ? "-low-charging" : "-low";
        } else if (levelState[0] < 60) {
            icon += levelState[1] === true ? "-good-charging" : "-good";
        } else if (levelState[0] >= 60) {
            icon += levelState[1] === true ? "-full-charging" : "-full";
        }
        
        this.batteryButton.child.icon_name = icon + "-symbolic";
        this.batteryLabel.text = levelState[0] + "%";
    },
    
    _pluginsChanged: function (device) {
        debug("extension.DeviceMenu._pluginsChanged()");
        
        // Device Menu Buttons
        let buttons = [
            [this.smsButton, "telephony"],
            [this.findButton, "findmyphone"]
        ];
        
        buttons.forEach((button) => {
            if (device.plugins.hasOwnProperty(button[1])) {
                button[0].can_focus = true;
                button[0].reactive = true;
                button[0].track_hover = true;
                button[0].opacity = 255;
            } else {
                button[0].can_focus = false;
                button[0].reactive = false;
                button[0].track_hover = false;
                button[0].opacity = 128;
            }
        });
        
        this._batteryChanged(device);
    },
    
    _trustedChanged: function (device, trusted) {
        debug("extension.DeviceMenu._trustedChanged()");
        
        trusted = (trusted !== undefined) ? trusted : device.trusted;
        
        if (trusted) {
            this.trustButton.child.icon_name = "channel-secure-symbolic";
        } else {
            this.trustButton.child.icon_name = "channel-insecure-symbolic";
        }
    },
    
    // Action Button Callbacks
    _findAction: function (button, device) {
        debug("extension.DeviceMenu._findmyphone()");
        
        device.plugins.findmyphone.find();
        this._getTopMenu().close(true);
    },
    
    _smsAction: function (button, device) {
        // TODO: track windows...
        debug("extension.DeviceMenu._sms()");
        
//        for (let i = 0; i < global.screen.n_workspaces; i++) {
//            let workspace = global.screen.get_workspace_by_index(i);
//            let windows = workspace.list_windows();
//            
//            windows.forEach((window) => {
//                debug(window.title.toString());
//                
//                for (let foo in window) {
//                    debug(foo.toString());
//                }
//            
//                if (window.startup_id === this.device.dbusPath) {
//                    Main.activateWindow(window);
//                    return;
//                }
//            });
//        }
        
        GLib.spawn_command_line_async(
            Me.path + "/sms.js \"" + device.dbusPath + "\""
        );
        
        this._getTopMenu().close(true);
    },
    
    _trustAction: function () {
        debug("extension.DeviceMenu._trustAction()");
        
        this.emit("request::trusted", this.device.dbusPath);
        this._getTopMenu().close(true);
    },
    
    // UI Callbacks
    _sync: function () {
        debug("extension.DeviceMenu._sync()");
        
        // Device Visibility
        if (!Settings.get_boolean("show-offline")) {
            this.actor.visible = device.active;
        } else if (!Settings.get_boolean("show-untrusted")) {
            this.actor.visible = device.trusted;
        } else {
            this.actor.visible = true;
        }
        
        this._activeChanged(this.device);
        this._pluginsChanged(this.device); // include _batteryChanged()
        this._trustedChanged(this.device);
    }
});

Signals.addSignalMethods(DeviceMenu.prototype);

// The main extension hub.
const SystemIndicator = new Lang.Class({
    Name: "SystemIndicator",
    Extends: PanelMenu.SystemIndicator,

    _init: function () {
        this.parent();
        
        this.manager = null;
        this.backend = Settings.get_boolean("use-kdeconnect") ? Me.imports.kdeconnect : Me.imports.mconnect;
        
        // device submenus
        this.deviceMenus = {};
        
        // System Indicator
        this.systemIndicator = this._addIndicator();
        this.systemIndicator.icon_name = "smartphone-symbolic";
        let userMenuTray = Main.panel.statusArea.aggregateMenu._indicators;
        userMenuTray.insert_child_at_index(this.indicators, 0);
        
        // Extension Menu
        this.mobileDevices = new PopupMenu.PopupSubMenuMenuItem("Mobile Devices", true);
        this.mobileDevices.icon.icon_name = "smartphone-symbolic";
        this.menu.addMenuItem(this.mobileDevices);
        
        // Extension Menu -> Devices Section -> [ DeviceMenu, ... ]
        this.devicesSection = new PopupMenu.PopupMenuSection();
        this.mobileDevices.menu.addMenuItem(this.devicesSection);
        
        // Extension Menu -> [ Enable Item ]
        this.enableItem = this.mobileDevices.menu.addAction(
            "Enable",
            this.backend.startDaemon
        );
        
        // Extension Menu -> Mobile Settings Item
        this.mobileDevices.menu.addAction(
            "Mobile Settings",
            this.backend.startSettings
        );
        
        //
        Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this.menu, 4);
        
        // Signals
        Settings.connect("changed::per-device-indicators", Lang.bind(this, this._sync));
        
        // Watch for DBus service
        this._watchdog = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            this.backend.BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            Lang.bind(this, this._daemonAppeared),
            Lang.bind(this, this._daemonVanished)
        );
        
        // Watch "start-daemon" setting
        Settings.connect("changed::start-daemon", (settings, key) => {
            debug("Settings: changed::start-daemon");
            
            if (Settings.get_boolean(key) && this.manager === null) {
                this.backend.startDaemon();
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
    
    _requestTrusted: function (menu, dbusPath) {
        debug("extension.SystemIndicator._trust(" + dbusPath + ")");
        
        let device = this.manager.devices[dbusPath];
        let action, params;
        
        
        // Prepare the dialog content
        if (device.trusted) {
            log("requesting unpairing for \"" + dbusPath + "\"");
            params = {
                message_type: Sw.MessageType.QUESTION,
                icon_name: "channel-insecure-symbolic",
                text: "Mark device as untrusted?",
                secondary_text: [
                    "Marking the " +  device.type + " \"" + device.name + "\" ",
                    "as untrusted will deny it access to your computer. ",
                    "Are you sure you want to proceed?"].join(""),
                buttons: Sw.ButtonsType.YES_NO
            }
            
            action = this.manager.untrustDevice;
        } else {
            log("confirming pairing for \"" + dbusPath + "\"");
            params = {
                message_type: Sw.MessageType.QUESTION,
                icon_name: "channel-secure-symbolic",
                text: "Mark device as trusted?",
                secondary_text: [
                    "Marking the " +  device.type + " \"" + device.name + "\" ",
                    "as trusted will allow it access to your computer and ",
                    "may pose a serious security risk. ",
                    "Are you sure you want to proceed?"].join(""),
                buttons: Sw.ButtonsType.YES_NO
            }
            
            action = this.manager.trustDevice;
        }
        
        // Prompt the user with the dialog
        let prompt = new Sw.MessageDialog(params);
        
        prompt.connect("response", (dialog, responseType) => {
            prompt.close();
            
            if (responseType === Sw.ResponseType.YES) {
                action(dbusPath)
            }
        });
        
        prompt.open();
    },
    
    // DBus Callbacks
    _daemonAppeared: function (conn, name, name_owner, cb_data) {
        // The DBus interface has appeared
        debug("extension.SystemIndicator._daemonAppeared()");
        
        // Initialize the manager and add current devices
        this.manager = new this.backend.DeviceManager();
        
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
            delete this.manager;
        }
        
        // Sync the UI
        this._sync();
        
        // Start the daemon or wait for it to start
        if (Settings.get_boolean("start-daemon")) {
            this.backend.startDaemon();
        } else {
            log("waiting for daemon");
        }
    },
    
    _deviceAdded: function (manager, signal_id, dbusPath) {
        debug("extension.SystemIndicator._deviceAdded(" + dbusPath + ")");
        
        let device = this.manager.devices[dbusPath];
        
        // Per-device indicator
        let indicator = new DeviceIndicator(device);
        indicator.deviceMenu.connect(
            "request::trusted",
            Lang.bind(this, this._requestTrusted)
        );
        Main.panel.addToStatusArea(dbusPath, indicator);
        
        // User menu entry
        this.deviceMenus[dbusPath] = new DeviceMenu(device);
        this.deviceMenus[dbusPath].connect(
            "request::trusted",
            Lang.bind(this, this._requestTrusted)
        );
        this.devicesSection.addMenuItem(this.deviceMenus[dbusPath]);
        
        this._sync();
    },
    
    _deviceRemoved: function (manager, signal_id, dbusPath) {
        debug("extension.SystemIndicator._deviceRemoved(" + dbusPath + ")");
        
        // Per-device indicator
        Main.panel.statusArea[dbusPath].destroy();
        
        // User menu entry
        this.deviceMenus[dbusPath].destroy();
        
        this._sync();
    },
    
    // Public Methods
    destroy: function () {
        this.manager.destroy();
        delete this.manager;
        
        // Destroy the UI
        this.devicesSection.destroy();
        this.mobileDevices.destroy();
        this.systemIndicator.destroy();
        this.menu.destroy();
    
        // Stop watching "start-daemon" & DBus
        Settings.disconnect("changed::start-daemon");
        
        // Stop watching for DBus Service
        Gio.bus_unwatch_name(this._watchdog);
    }
});


var systemIndicator; // FIXME: not supposed to mix "let" and "var"

function init() {
    debug("initializing extension");
    
    // TODO: localization
};
 
function enable() {
    debug("enabling extension");
    
    // Create the UI
    systemIndicator = new SystemIndicator();
    
    Settings.connect(
        "changed::use-kdeconnect",
        function (settings, key, cb_data) {
            debug("Settings: changed::use-kdeconnect");
            
            systemIndicator.destroy();
            systemIndicator = new SystemIndicator();
        }
    );
};
 
function disable() {
    debug("disabling extension");
    
    // Destroy the UI
    systemIndicator.destroy();
};



