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
const Signals = imports.signals;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, Settings } = Me.imports.prefs;
const MConnect = Me.imports.mconnect;


// TODO: reuse ui.components.telepathyClient if possible
//const Telepathy = imports.ui.components.telepathyClient
//const MessageWidget = new Lang.Class({
//    Name: "Indicator.menu",
//    Extends: Telepathy.NotificationBanner,
//    
//    _init: function () {
//    },
//});


// Useful UI Functions
function getBatteryIcon(level_state = [null, null]) {
    // Return an icon name, relevant to battery level and state (charging/not)
    // Also a callback for 'battery' signal
    let icon;
    
    switch (true) {
        case (level_state[0] == null):
            return 'battery-missing-symbolic'
        case (level_state[0] == 100):
            icon = 'battery-full';
            break;
        case (level_state[0] > 20):
            icon = 'battery-good';
            break;
        case (level_state[0] <= 20):
            icon = 'battery-good';
            break;
        case (level_state[0] == 0):
            icon = 'battery-empty';
            break;
    };
    
    if (level_state[1]) {
        icon = icon + '-charging';
    };
    
    return icon + '-symbolic';
};
    
function getDeviceIcon(device) {
    // Return an icon name, relevant to the device
    let icon;
    
    switch (device.type) {
        case 'phone':
            icon = 'smartphone';
            break;
        default:
            icon = device.type;
    };
   
    if (device.active) {
        return icon + '-connected';
    } else {
        return icon + '-disconnected';
    };
};

function getDeviceMenu(device) {
    // Return a PopupMenu.PopupMenu, relevant for the device
    
    let menu = new PopupMenu.PopupMenu();
        
    // Menu Items
    //// Name Item
    let batteryIcon = getBatteryIcon(device);
    
    let menuDeviceItem = new PopupMenu.PopupImageMenuItem(
        device.name,
        batteryIcon,
        {activate: true, reactive: true}
    );
    
    // Connect to 'Device.battery' signal
    device.connect(
        'battery',
        Lang.bind(
            this,
            function (device, user_data) {
                batteryIcon = getBatteryIcon(user_data);
                
                menuDeviceItem.setIcon(batteryIcon);
            }
        )
    );
    
    // Connect to 'activate' signal
    menuDeviceItem.connect(
        'activate',
        Lang.bind(
            this,
            function (deviceItem) {
                //
            }
        )
    );
    
    menu.addMenuItem(menuDeviceItem);
    
    return menu
};


// A Re-Wrapper for MConnect.Device representing a device in Menu.panel.statusArea
//
// Hierarchy:
// 
// PanelMenu.Button (Extends PanelMenu.ButtonBox)
//    -> St.Bin (this.container)
//        -> StBox (this.actor)
//    -> PopupMenu.PopupMenu (this.menu)
const StatusIndicator = new Lang.Class({
    Name: "Indicator.menu",
    Extends: PanelMenu.Button,
    
    _init: function (device) {
        this.parent(null, "Indicator.menu");
        
        this.device = device;
        
        // Device Icon
        this.icon = new St.Icon({ icon_name: 'smartphone-disconnected', style_class: "system-status-icon"});
        this.actor.add_actor(this.icon);
        this.icon.icon_name = getDeviceIcon(device);
        
        // Menu
        this.menu = getDeviceMenu(device);
    }
});

//
//
// PanelMenu.SystemIndicator
//     -> St.BoxLayout (this.indicators)
//         -> St.Icon
//     -> PopupMenu.PopupMenuSection (this.menu)
const SystemIndicator = new Lang.Class({
    Name: 'MConnect.Indicator',
    Extends: PanelMenu.SystemIndicator,
    
    _userMenu: Main.panel.statusArea.aggregateMenu.menu,
    _userMenuTray: Main.panel.statusArea.aggregateMenu._indicators,
    _statusArea: Main.panel.statusArea,

    _init: function(manager) {
        this.parent();
        
        this.manager = manager;
        
        // Icon
        let indicator = this._addIndicator();
        indicator.icon_name = 'smartphone-symbolic';
        this._userMenuTray.insert_child_at_index(this.indicators, 0);
        
        // Extension Menu
        this.item = new PopupMenu.PopupSubMenuMenuItem('Mobile Devices', true);
        this.item.icon.icon_name = 'smartphone-symbolic';
        
        // Extension Menu // TODO: dynamic start-daemon item
        
        // Extension Menu // Settings Item
        this.item.menu.addAction(
            'Settings',
            function () {
                Util.spawn(["gnome-shell-extension-prefs", Me.metadata.uuid]);
            }
        );
        this.menu.addMenuItem(this.item);
        this._userMenu.addMenuItem(this.menu, 4);
        
        // Signals
        Settings.connect('changed::menu-always', Lang.bind(this, this._sync));
        Settings.connect('changed::per-device-indicators', Lang.bind(this, this._sync));

        // TODO: investigate what this does
        //Main.sessionMode.connect('updated', Lang.bind(this, this._sessionUpdated));
        //this._sessionUpdated();
        
        // Finish by calling this._sync()
        this._sync();
    },

    // TODO: Original subclass methods
    _sessionUpdated: function() {
        let sensitive = !Main.sessionMode.isLocked && !Main.sessionMode.isGreeter;
        this.menu.setSensitive(sensitive);
    },
    
    // UI Settings callbacks
    _sync: function (settings, key, user_data) {
        // TODO: GSettings option for what states to show devices
        // TODO: GSettings option for indicator when no device present
        debug('_sync() called');
        
        // User Menu visibility
        if (Settings.get_boolean('menu-always') || this.manager != null) {
            this.menu.actor.visible = true;
        } else {
            this.menu.actor.visible = false;
        };
        
        // FIXME: ugly
        let devices;
        
        if (!this.manager) {
            devices = {};
        } else {
            devices = this.manager.devices;
        };
        
        // Indicator visibility
        if (Settings.get_boolean('per-device-indicators')) {
            for (let busPath in devices) {
                this._statusArea[busPath].actor.visible = true;
            };
            
            this.indicators.get_first_child().visible = false;
        } else {
            for (let busPath in devices) {
                this._statusArea[busPath].actor.visible = false;
            };
            
            this.indicators.get_first_child().visible = true;
        };
    },
    
    addDevice: function (manager, signal, device) {
        // TODO: userMenu submenu per device
        debug('addDevice() called on device at ' + device.busPath);
        
        let indicator = new StatusIndicator(device);
        
        if (Settings.get_boolean('per-device-indicators')) {
            indicator.actor.visible = true;
        } else {
            indicator.actor.visible = false;
        };
        
        Main.panel.addToStatusArea(device.busPath, indicator);
        indicator.emit('menu-set', null); // FIXME menus
    },
    
    removeDevice: function (device) {
        // TODO: userMenu submenus, use as a callback?
        debug('removeDevice() called on device at ' + device.busPath);
        
        this._statusArea[device.busPath].destroy();
    }
});


//
var systemIndicator;
var watchdog;

// TODO: figure out how to use these proper
function init() {
    debug('initializing extension');
    
    // System Indicator
    debug('enabling SystemIndicator');
    systemIndicator = new SystemIndicator();
};
 
function enable() {
    debug('enabling extension');
    
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
        function (settings, key, user_data) {
            debug('SIGNAL: changed::start-daemon');
            
            if (Settings.get_boolean(key) && systemIndicator.manager == null) {
                MConnect.startDaemon();
            };
        }
    );
};
 
function disable() {
    debug('disabling extension');
    
    // Stop watching for DBus Service
    Gio.bus_unwatch_name(watchdog);
    
    // Stop watching 'start-daemon' setting
    // ERROR: gsignal.c:2641: instance '0x55d236fa6610' has no handler with id '9223372036854775808'
    //Settings.disconnect('start-daemon');
    
    // FIXME: not sure this is good enough
    if (systemIndicator.manager != null) {
        for (let busPath in systemIndicator.manager.devices) {
            systemIndicator.removeDevice(manager.devices[busPath]);
        };

        systemIndicator.manager = null; // FIXME
    };
};

// DBus Watchdog Callbacks
function daemonAppeared(conn, name, name_owner, user_data) {
    // The DBus interface has appeared, setup
    debug('daemonAppeared() called');
    
    systemIndicator.manager = new MConnect.DeviceManager();
    
    // Add current devices
    for (let busPath in systemIndicator.manager.devices) {
        systemIndicator.addDevice(
            systemIndicator.manager,
            'device-added',
            systemIndicator.manager.devices[busPath]
        );
    };
    
    // Watch for new devices
    systemIndicator.manager.connect(
        'device-added',
        Lang.bind(systemIndicator, systemIndicator.addDevice)
    );
};

function daemonVanished(conn, name, name_owner, user_data) {
    // The DBus interface has vanished
    debug('daemonVanished() called');
    
    // If a manager is initialized, clear it
    if (systemIndicator.manager != null) {
    
        for (let busPath in systemIndicator.manager.devices) {
            systemIndicator.removeDevice(systemIndicator.manager.devices[busPath]);
        };
    
        systemIndicator.manager = null;
    };
    
    //
    systemIndicator._sync();
    
    // Start the daemon or wait for it to start
    if (Settings.get_boolean('start-daemon')) {
        MConnect.startDaemon();
    } else {
        log('waiting for daemon');
    };
};



