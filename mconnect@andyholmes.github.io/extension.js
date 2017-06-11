"use strict";

// Imports
const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, Settings } = Me.imports.prefs;


const DeviceMenu = new Lang.Class({
    Name: "DeviceMenu",
    Extends: PopupMenu.PopupMenuSection,
    
    _init: function (device) {
        this.parent(null, "DeviceMenu");
        
        this.device = device;
        
        // Menu Items // Separator
        this.deviceItem = new PopupMenu.PopupSeparatorMenuItem(this.device.name);
        this.deviceItem.icon = new St.Icon({
            icon_name: "battery-missing-symbolic",
            style_class: "popup-menu-icon"
        });
        this.deviceItem.actor.add(this.deviceItem.icon);
        this._battery();
        this.addMenuItem(this.deviceItem);
        
        // Action Bar
        this.actionBar = new PopupMenu.PopupBaseMenuItem({ reactive: false,
                                                           can_focus: false });
        
        // Send SMS Action
        this.smsAction = this._createActionButton("user-available-symbolic");
        this.smsAction.connect("clicked", Lang.bind(this, this._sync));
        this.actionBar.actor.add(this.smsAction, { expand: true, x_fill: false });
        
        // Find my phone Action
        this.findAction = this._createActionButton("find-location-symbolic");
        this.findAction.connect("clicked", Lang.bind(this, this._findmyphone));
        this.actionBar.actor.add(this.findAction, { expand: true, x_fill: false });
        
        // Menu Items // Settings Item
//        this._setAction = this._createActionButton("preferences-system-symbolic");
//        this._setAction.connect("clicked", Lang.bind(this, this._sync));
//        this.actionBar.actor.add(this._setAction, { expand: true, x_fill: false });
        
        this.addMenuItem(this.actionBar);
        
        // Connect to "Device.changed::battery" signal
        this.device.connect("changed::battery", Lang.bind(this, this._battery));
    },
    
    _createActionButton: function (iconName) {
        let icon = new St.Button({
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: "system-menu-action"
        });
        
        icon.set_style("padding: 8px;");
        
        icon.child = new St.Icon({ icon_name: iconName });
        return icon;
    },
    
    // Callbacks
    _battery: function (device, signal_id, level_state) {
        // FIXME: called 5+ times per signal
        // Set the icon name, relevant to battery level and charging state
        debug("Signal Callback: DeviceMenu._battery(): " + level_state);
        
        let icon;
        
        // Try the get data from the device itself
        if (!level_state) {
            level_state = [
                this.device.plugins.battery.level,
                this.device.plugins.battery.charging
            ];
        }
        
        // Pretty much how upower does it
        if (level_state[0] == -1) { // Default for mconnect right now
            icon = "battery-missing";
        } else if (level_state[0] < 3) {
            icon = level_state[1] ? "battery-empty-charging" : "battery-empty";
        } else if (level_state[0] < 10) {
            icon = level_state[1] ? "battery-caution-charging" : "battery-caution";
        } else if (level_state[0] < 30) {
            icon = level_state[1] ? "battery-low-charging" : "battery-low";
        } else if (level_state[0] < 60) {
            icon = level_state[1] ? "battery-good-charging" : "battery-good";
        } else if (level_state[0] >= 60) {
            icon = level_state[1] ? "battery-full-charging" : "battery-full";
        }
        
        this.deviceItem.icon.icon_name = icon + "-symbolic";
    },
    
    _findmyphone: function (button, signal_id) {
        debug("DeviceMenu._findmyphone()");
        
        if (this.device.plugins.findmyphone) {
            this.device.plugins.findmyphone.find();
        }
    },
    
    _sync: function () {
        debug("DeviceMenu._sync()");
        
        switch (true) {
            case (this.device.plugins.battery):
                // TODO: handle the battery differently
                break;
            case (this.device.plugins.findmyphone):
                this.findAction.visible = true;
                break;
            case (this.device.plugins.ping):
                break;
            case (this.device.plugins.sms):
                this.smsAction.visible = true;
                break;
            case (this.device.plugins.telephony):
                break;
        }
    }
});


// A Re-Wrapper for backend.Device representing a device in Menu.panel.statusArea
// 
// PanelMenu.Button (Extends PanelMenu.ButtonBox)
//    -> St.Bin (this.container)
//        -> StBox (this.actor)
//    -> PopupMenu.PopupMenu (this.menu)
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
        
        this._status();
        
        // FIXME: Device Menu
        let menu = new DeviceMenu(device);
        //menu._setParent(this.actor);
        this.menu.addMenuItem(menu);
        
        // Signals
        this.device.connect("changed::active", Lang.bind(this, this._status));
    },
    
    // Callbacks
    _status: function (device, signal_id, cb_data) {
        let icon = this.device.type;
        
        switch (true) {
            // Type correction for icons
            case (this.device.type == "phone"):
                icon = "smartphone";
            // Status
            case (this.device.active):
                this.icon.icon_name = icon + "-connected";
                break;
            case (this.device.allowed || this.device.paired):
                this.icon.icon_name = icon + "-trusted";
                break;
            default:
                this.icon.icon_name = icon + "-disconnected";
        }
    }
});

// The main extension hub.
//
// PanelMenu.SystemIndicator
//     -> St.BoxLayout (this.indicators)
//         -> St.Icon
//     -> PopupMenu.PopupMenuSection (this.menu)
const SystemIndicator = new Lang.Class({
    Name: "SystemIndicator",
    Extends: PanelMenu.SystemIndicator,

    _init: function () {
        this.parent();
        
        this.manager = null;
        this.backend = Settings.get_boolean("use-kdeconnect") ? Me.imports.kdeconnect : Me.imports.mconnect;
        
        // device submenus
        this.deviceMenus = {};
        
        // Icon
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
        Settings.connect("changed::show-inactive", Lang.bind(this, this._sync));
        Settings.connect("changed::show-unallowed", Lang.bind(this, this._sync));
        Settings.connect("changed::show-unpaired", Lang.bind(this, this._sync));
        Main.sessionMode.connect("updated", Lang.bind(this, this._sessionUpdated));
        
        // Sync the UI
        this._sessionUpdated();
        
        // Watch for DBus service
        this._watchdog = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            this.backend.BUS_NAME,
            Gio.BusNameWatcherFlags.NONE,
            Lang.bind(this, this._daemonAppeared),
            Lang.bind(this, this._daemonVanished)
        );
        
        // Watch "start-daemon" setting
        Settings.connect(
            "changed::start-daemon",
            Lang.bind(
                this,
                function (settings, key, cb_data) {
                    debug("Settings: changed::start-daemon");
                    
                    if (Settings.get_boolean(key) && this.manager == null) {
                        this.backend.startDaemon();
                    }
                }
            )
        );
    },

    _sessionUpdated: function (sessionMode) {
        // Keep menu disabled when desktop locked
        // FIXME: Extension.disable() is called anyways?
        let sensitive = !Main.sessionMode.isLocked && !Main.sessionMode.isGreeter;
        this.menu.setSensitive(sensitive);
    },
    
    // UI Settings callbacks
    _isVisible: function (device) {
        // Return boolean whether user considers device visible or not
        // FIXME: dun broken son
        debug("SystemIndicator._isVisible()");
        
        let visible = [];
        
        switch (false) {
            case Settings.get_boolean("show-unpaired"):
                visible.push(device.paired);
            case Settings.get_boolean("show-unallowed"):
                visible.push(device.allowed);
            case Settings.get_boolean("show-inactive"):
                visible.push(device.paired);
        }
        
        return (!visible.indexOf(false) > -1);
    },
    
    _sync: function () {
        debug("SystemIndicator._sync()");
        
        if (this._pauseSync) {
            return;
        }
        
        // Show "Enable" if backend not running
        this.enableItem.actor.visible = (this.manager) ? false : true;
        
        for (let busPath in this.deviceMenus) {
            if (Object.keys(this.deviceMenus).length < 1) {
                return;
            }
        
            let deviceIndicator = Main.panel.statusArea[busPath];
            let deviceMenu = this.deviceMenus[busPath];
            let visible = false;
            
            if (this.manager) {
                visible = this._isVisible(this.manager.devices[busPath])
            }
            
            // Show per-device indicators OR user menu entries
            if (Settings.get_boolean("per-device-indicators")) {
                deviceIndicator.actor.visible = visible;
                deviceMenu.actor.visible = false;
                this.systemIndicator.visible = (!this.manager);
            } else {
                this.systemIndicator.visible = true;
                deviceMenu.actor.visible = visible;
                deviceIndicator.actor.visible = false;
            }
        }
    },
    
    _daemonAppeared: function (conn, name, name_owner, cb_data) {
        // The DBus interface has appeared
        debug("SystemIndicator._daemonAppeared()");
        
        // Initialize the manager and add current devices
        this.manager = new this.backend.DeviceManager();
        
        for (let busPath in this.manager.devices) {
            systemIndicator.addDevice(this.manager, null, busPath);
        }
        
        // Sync the UI
        this._sync();
        
        // Watch for new and removed devices
        this.manager.connect(
            "device::added",
            Lang.bind(this, this.addDevice)
        );
        
        this.manager.connect(
            "device::removed",
            Lang.bind(this, this.removeDevice)
        );
    },
    
    _daemonVanished: function (conn, name, name_owner, cb_data) {
        // The DBus interface has vanished
        debug("SystemIndicator.daemonVanished()");
        
        // Stop watching for new and remove devices
        // TODO: JS ERROR: Error: No signal connection device::added found
        //       JS ERROR: Error: No signal connection device::removed found
        //this.manager.disconnect("device::added");
        //this.manager.disconnect("device::removed");
        
        // If a manager is initialized, destroy it
        if (this.manager) {
            this._pauseSync = true;
            this.manager.destroy();
            delete this.manager;
            this._pauseSync = false;
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
    
    addDevice: function (manager, signal_id, busPath) {
        debug("Signal Callback: SystemIndicator.addDevice: " + busPath);
        
        let device = manager.devices[busPath];
        
        // Per-device indicator
        let indicator = new DeviceIndicator(device);
        Main.panel.addToStatusArea(busPath, indicator);
        
        // User menu entry
        this.deviceMenus[busPath] = new DeviceMenu(device);
        this.devicesSection.addMenuItem(this.deviceMenus[busPath]);
        
        this._sync();
    },
    
    removeDevice: function (manager, signal_id, busPath) {
        debug("Signal Callback: SystemIndicator.removeDevice: " + busPath);
        
        // Per-device indicator
        Main.panel.statusArea[busPath].destroy();
        
        // User menu entry
        this.deviceMenus[busPath].destroy();
        
        this._sync();
    },
    
    destroy: function () {
        this._pauseSync = true;
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



