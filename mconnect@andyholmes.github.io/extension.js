'use strict';

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
const MConnect = Me.imports.mconnect;


// Useful UI Functions
function getDeviceIcon(device) {
    // Return an icon name, relevant to the device
    // TODO: return "standard" icon names only?
    let icon;
    
    switch (device.type) {
        case 'phone':
            icon = 'smartphone';
            break;
        default:
            icon = device.type;
    };
    
    // TODO: still not clear on the distinction here
    if (device.active) {
        return icon + '-connected';
    } else if (device.allowed || device.paired) {
        return icon + '-trusted';
    }
    
    return icon + '-disconnected';
};


const DeviceMenu = new Lang.Class({
    Name: 'DeviceMenu',
    Extends: PopupMenu.PopupMenuSection,
    
    _init: function (device) {
        this.parent(null, 'DeviceMenu');
        
        this.device = device;
        
        // Menu Items
        //// Name Item
        this.deviceItem = new PopupMenu.PopupImageMenuItem(
            this.device.name,
            'battery-missing-symbolic',
            {activate: true, reactive: true}
        );
        
        this._battery(device, null, null);
        
        // Connect to 'Device.battery' signal
        this.device.connect('battery', Lang.bind(this, this._battery));
        
        // Connect to 'activate' signal
        this.deviceItem.connect(
            'activate',
            Lang.bind(
                this,
                function (deviceItem, signal_id, cb_data) {
                    //
                    debug('deviceItem activated');
                }
            )
        );
        
        this.addMenuItem(this.deviceItem);
    },
    
    _battery: function (device, signal_id, cb_data) {
        // FIXME: called 5 times per signal
        // Set the icon name, relevant to battery level and charging state
        debug('Signal Callback: _battery: ' + cb_data);
        
        let icon;
        
        switch (true) {
            case (!cb_data):
                this.deviceItem.setIcon('battery-missing-symbolic');
                return;
            case (cb_data[0] == 100):
                icon = 'battery-full';
                break;
            case (cb_data[0] > 20):
                icon = 'battery-good';
                break;
            case (cb_data[0] <= 20):
                icon = 'battery-good';
                break;
            case (cb_data[0] == 0):
                icon = 'battery-empty';
                break;
        };
        
        if (cb_data[1]) {
            icon = icon + '-charging';
        };
        
        this.deviceItem.setIcon(icon + '-symbolic');
    },
    
    _sync: function () {
        // TODO: this might be a parent method?
    }
});


// A Re-Wrapper for MConnect.Device representing a device in Menu.panel.statusArea
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
            icon_name: getDeviceIcon(device),
            style_class: "system-status-icon"
        });
        this.actor.add_actor(this.icon);
        
        // FIXME: Device Menu
        let menu = new DeviceMenu(device);
        menu._setParent(this.actor);
        this.setMenu(menu);
    }
});

// The main extension hub.
//
// PanelMenu.SystemIndicator
//     -> St.BoxLayout (this.indicators)
//         -> St.Icon
//     -> PopupMenu.PopupMenuSection (this.menu)
const SystemIndicator = new Lang.Class({
    Name: 'MConnectIndicator',
    Extends: PanelMenu.SystemIndicator,

    _init: function(manager) {
        this.parent();
        
        this.manager = manager;
        
        // device submenus
        this.deviceMenus = {};
        
        // Icon
        this.systemIndicator = this._addIndicator();
        this.systemIndicator.icon_name = 'smartphone-symbolic';
        let userMenuTray = Main.panel.statusArea.aggregateMenu._indicators;
        userMenuTray.insert_child_at_index(this.indicators, 0);
        
        // Extension Menu
        //
        // PopupSubMenuMenuItem
        //     -> St.BoxLayout (this.actor)
        //         -> St.Icon (this.icon)
        //         -> St.Label (this.label)
        //     -> PopupSubMenu (this.menu)
        //         -> PopupSubMenuMenuItem (this.mobileDevices)
        //             -> 
        //
        this.mobileDevices = new PopupMenu.PopupSubMenuMenuItem('Mobile Devices', true);
        this.mobileDevices.icon.icon_name = 'smartphone-symbolic';
        this.menu.addMenuItem(this.mobileDevices);
        
        // Mobile Devices //
        // Mobile Devices -> Devices Section
        this.devicesSection = new PopupMenu.PopupMenuSection();
        this.mobileDevices.menu.addMenuItem(this.devicesSection)
        
        // Extension Menu -> Enable Item
        this.enableItem = this.mobileDevices.menu.addAction('Enable', MConnect.startDaemon);
        
        // Extension Menu -> Mobile Settings Item
        this.mobileDevices.menu.addAction(
            'Mobile Settings',
            function () {
                Util.spawn(["gnome-shell-extension-prefs", Me.metadata.uuid]);
            }
        );
        
        //
        Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this.menu, 4);
        
        // Signals
        Settings.connect('changed::per-device-indicators', Lang.bind(this, this._sync));
        Settings.connect('changed::show-inactive', Lang.bind(this, this._sync));
        Settings.connect('changed::show-unallowed', Lang.bind(this, this._sync));
        Settings.connect('changed::show-unpaired', Lang.bind(this, this._sync));
        Main.sessionMode.connect('updated', Lang.bind(this, this._sessionUpdated));
        
        // Sync the UI
        this._sync();
        this._sessionUpdated();
    },

    _sessionUpdated: function(sessionMode) {
        // Keep menu disabled when desktop locked
        let sensitive = !Main.sessionMode.isLocked && !Main.sessionMode.isGreeter;
        this.menu.setSensitive(sensitive);
    },
    
    // UI Settings callbacks
    _getDeviceVisible: function (device) {
        // TODO: decide on some hierarchy here
        let visible;
        
        visible = Settings.get_boolean('show-inactive') ? true : device.active;
        visible = Settings.get_boolean('show-unpaired') ? true : device.paired;
        visible = Settings.get_boolean('show-unallowed') ? true : device.allowed;
        
        return visible;
    },
    
    _sync: function () {
        // TODO: all seems very sketchy
        debug('_sync() called');
        
        // Show 'Enable' if mconnect not running
        this.enableItem.actor.visible = (this.manager) ? false : true;
        
        // return manager.devices as an empty object if mconnect not running
        let devices = (this.manager) ? this.manager.devices : {};
        
        // Indicator visibility
        for (let busPath in devices) {
            // Allows calling this._sync() before all devices have widgets
            if (!Main.panel.statusArea[busPath] || !this.deviceMenus[busPath]) {
                continue;
            };
        
            let device = devices[busPath];
            let deviceIndicator = Main.panel.statusArea[busPath];
            let menu = new DeviceMenu(device);
            let deviceVisible = this._getDeviceVisible(device);
            
            if (Settings.get_boolean('per-device-indicators')) {
                // Per-device indicator
                deviceIndicator.actor.visible = deviceVisible;
                // User menu entry
                this.deviceMenus[busPath].actor.visible = deviceVisible;
                // System indicator
                this.systemIndicator.visible = false;
            } else {
                // System indicator
                this.systemIndicator.visible = true;
                // User menu entry
                this.deviceMenus[busPath].actor.visible = deviceVisible;
                // Per-device indicator
                deviceIndicator.actor.visible = false;
            };
        };
        
        // TODO: Set the menu item label if only one device
//        if (Object.keys(devices).length == 1) {
//            this.label.text = device.name;
//        };
    },
    
    addDevice: function (manager, signal_id, busPath) {
        debug('Signal Callback: SystemIndicator.addDevice: ' + busPath);
        
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
        debug('Signal Callback: SystemIndicator.removeDevice: ' + busPath);
        
        // Per-device indicator
        Main.panel.statusArea[busPath].destroy();
        
        // User menu entry
        this.deviceMenus[busPath].destroy();
        
        this._sync();
    },
    
    destroy: function () {
        this.manager.destroy();
        delete this.manager;
        
        // TODO: check this
        this.item.destroy();
        this.menu.destroy();
    }
});


//
var systemIndicator;
var watchdog;

function init() {
    debug('initializing extension');
    
    // TODO: localization
};
 
function enable() {
    debug('enabling extension');
    
    // Create the UI
    systemIndicator = new SystemIndicator();
    
    // Watch for DBus service
    watchdog = Gio.bus_watch_name(
        Gio.BusType.SESSION,
        'org.mconnect',
        Gio.BusNameWatcherFlags.NONE,
        daemonAppeared,
        daemonVanished
    );
    
    // Watch 'start-daemon' setting
    Settings.connect(
        'changed::start-daemon',
        function (settings, key, cb_data) {
            debug('Signal: changed::start-daemon');
            
            if (Settings.get_boolean(key) && systemIndicator.manager == null) {
                MConnect.startDaemon();
            };
        }
    );
};
 
function disable() {
    debug('disabling extension');
    
    // Stop watching 'start-daemon' setting
    Settings.disconnect('changed::start-daemon');
    
    // Stop watching for DBus Service
    Gio.bus_unwatch_name(watchdog);
    
    // Destroy the UI
    systemIndicator.destroy();
};

// DBus Watchdog Callbacks
function daemonAppeared(conn, name, name_owner, cb_data) {
    // The DBus interface has appeared
    debug('daemonAppeared() called');
    
    // Initialize the manager and add current devices
    systemIndicator.manager = new MConnect.DeviceManager();
    
    for (let busPath in systemIndicator.manager.devices) {
        systemIndicator.addDevice(
            systemIndicator.manager,
            null,
            busPath
        );
    };
    
    systemIndicator._sync();
    
    // Watch for new and removed devices
    systemIndicator.manager.connect(
        'device-added',
        Lang.bind(systemIndicator, systemIndicator.addDevice)
    );
    
    systemIndicator.manager.connect(
        'device-removed',
        Lang.bind(systemIndicator, systemIndicator.removeDevice)
    );
};

function daemonVanished(conn, name, name_owner, cb_data) {
    // The DBus interface has vanished
    debug('daemonVanished() called');
    
    // Stop watching for new and remove devices
    // TODO: JS ERROR: Error: No signal connection device-added found
    //       JS ERROR: Error: No signal connection device-removed found
    //systemIndicator.manager.disconnect('device-added');
    //systemIndicator.manager.disconnect('device-removed');
    
    // If a manager is initialized, destroy it
    if (systemIndicator.manager) {
        systemIndicator.manager.destroy();
        delete systemIndicator.manager;
    };
    
    // Sync the UI
    systemIndicator._sync();
    
    // Start the daemon or wait for it to start
    if (Settings.get_boolean('start-daemon')) {
        MConnect.startDaemon();
    } else {
        log('waiting for daemon');
    };
};



