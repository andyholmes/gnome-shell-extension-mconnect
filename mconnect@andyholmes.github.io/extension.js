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
    
    // FIXME: still not clear on the distinction here
    if (device.active) {
        return icon + '-connected';
    } else if (device.allowed || device.paired) {
        return icon + '-trusted';
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
                alert('foo');
            }
        )
    );
    
    menu.addMenuItem(menuDeviceItem);
    
    return menu
};


// A Re-Wrapper for MConnect.Device representing a device in Menu.panel.statusArea
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
        let menu = getDeviceMenu(device);
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
    Name: 'MConnect.Indicator',
    Extends: PanelMenu.SystemIndicator,

    _init: function(manager) {
        this.parent();
        
        this.manager = manager;
        
        // Icon
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'smartphone-symbolic';
        let userMenuTray = Main.panel.statusArea.aggregateMenu._indicators;
        userMenuTray.insert_child_at_index(this.indicators, 0);
        
        // Extension Menu
        //
        // PopupSubMenuMenuItem
        //     -> St.BoxLayout (this.actor)
        //         -> St.Icon (this.icon)
        //         -> St.Label (this.label)
        //     -> PopupSubMenu (this.menu)
        //         -> PopupSubMenuMenuItem (this.item)
        //             -> 
        //
        this.item = new PopupMenu.PopupSubMenuMenuItem('Mobile Devices', true);
        this.item.icon.icon_name = 'smartphone-symbolic';
        this.menu.addMenuItem(this.item);
        this._menu = this.item.menu;
        
        // Extension Menu // TODO: dynamic start-daemon item
        
        // Extension Menu // Settings Item
        this._menu.addAction(
            'Mobile Settings',
            function () {
                Util.spawn(["gnome-shell-extension-prefs", Me.metadata.uuid]);
            }
        );
        
        //
        Main.panel.statusArea.aggregateMenu.menu.addMenuItem(this.menu, 4);
        
        // Signals
        Settings.connect('changed::menu-always', Lang.bind(this, this._sync));
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
        let visible;
        
        visible = Settings.get_boolean('show-inactive') ? true : device.active;
        visible = Settings.get_boolean('show-unpaired') ? true : device.paired;
        visible = Settings.get_boolean('show-unallowed') ? true : device.allowed;
        
        return visible;
    },
    
    _sync: function () {
        // TODO: GSettings option for what states to show devices
        // TODO: GSettings option for indicator when no device present
        debug('_sync() called');
        
        // User Menu visibility
        if (Settings.get_boolean('menu-always') || this.manager != null) {
            this.menu.actor.visible = true;
        } else {
            this.menu.actor.visible = false;
        };
        
        let devices = this.manager ? this.manager.devices : {};
        
        // Indicator visibility
        if (Settings.get_boolean('per-device-indicators')) {
            for (let busPath in devices) {
                Main.panel.statusArea[busPath].actor.visible = this._getDeviceVisible(devices[busPath]);
            };
            
            this._indicator.visible = false;
        } else {
            this._indicator.visible = true;
            
            for (let busPath in devices) {
                Main.panel.statusArea[busPath].actor.visible = false;
            };
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
        
        // Set the menu item label if only one device
        if (Object.keys(manager.devices).length == 1) {
            this.label.text = device.name;
        };
    },
    
    removeDevice: function (device) {
        // TODO: userMenu submenus
        debug('removeDevice() called on device at ' + device.busPath);
        
        Main.panel.statusArea[device.busPath].destroy();
    },
    
    destroy: function () {
        //
        for (let busPath in this.manager.devices) {
            this.removeDevice(this.manager.devices[busPath]);
        };
        
        this.item.destroy();
        this.menu.destroy();

        this.manager.destroy();
        this.manager = null;
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
    
    //
    systemIndicator.destroy();
};

// DBus Watchdog Callbacks
function daemonAppeared(conn, name, name_owner, user_data) {
    // The DBus interface has appeared
    debug('daemonAppeared() called');
    
    // Initialize the manager and add current devices
    systemIndicator.manager = new MConnect.DeviceManager();
    
    for (let busPath in systemIndicator.manager.devices) {
        systemIndicator.addDevice(
            systemIndicator.manager,
            'device-added',
            systemIndicator.manager.devices[busPath]
        );
    };
    
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

function daemonVanished(conn, name, name_owner, user_data) {
    // The DBus interface has vanished
    debug('daemonVanished() called');
    
    // If a manager is initialized, destroy it
    if (systemIndicator.manager != null) {
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



