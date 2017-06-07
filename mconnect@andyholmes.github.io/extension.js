'use strict';

// Imports
const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

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

// A Re-Wrapper for MConnect.Device
const Indicator = new Lang.Class({
    Name: "Indicator.menu",
    Extends: PanelMenu.Button,
    
    _init: function (device) {
        this.parent(null, "Indicator.menu");
        
        this.device = device;
        
        // Signals
        //this.device.connect('changed::active', Lang.bind(this, this.activeChanged));
        
        // Popup Menu Items
        //// Indicator Icon
        this.icon = new St.Icon({ icon_name: 'smartphone-disconnected', style_class: "system-status-icon"});
        this.actor.add_actor(this.icon);
        this.activeChanged(this.device, this.device.active);
        
        //// Name Item
        let batteryIcon = this._getBatteryIcon();
        
        this.menuDeviceItem = new PopupMenu.PopupImageMenuItem(
            this.device.name,
            batteryIcon,
            {activate: true, reactive: true}
        );
        this.device.connect(
            'battery',
            Lang.bind(
                this,
                function (device, user_data) {
                    batteryIcon = this._getBatteryIcon(user_data);
                    
                    this.menuDeviceItem.setIcon(batteryIcon);
                }
            )
        );
        this.menuDeviceItem.connect(
            'activate',
            Lang.bind(
                this,
                function (deviceItem) {
                    //
                }
            )
        );
        this.menu.addMenuItem(this.menuDeviceItem);
    },

    _getBatteryIcon: function (user_data = null) {
        let icon;
        
        switch (true) {
            case (user_data == null):
                return 'battery-missing-symbolic'
            case (user_data[0] == 100):
                icon = 'battery-full';
                break;
            case (user_data[0] > 20):
                icon = 'battery-good';
                break;
            case (user_data[0] <= 20):
                icon = 'battery-good';
                break;
            case (user_data[0] == 0):
                icon = 'battery-empty';
                break;
        };
        
        if (user_data[1]) {
            icon = icon + '-charging';
        };
        
        debug('battery icon: ' + icon + '-symbolic');
        
        return icon + '-symbolic';
    },
    
    disable: function () {
        this.menu.removeAll();
        this.destroy();
    },
    
    // Callbacks
    activeChanged: function (device, active) {
        // FIXME: not a DBus signal yet
        if (device.type == 'phone') {
            var type = 'smartphone';
        } else {
            var type = device.type;
        };
        
        if (active) {
            this.icon.icon_name = type + '-trusted';
        } else {
            this.icon.icon_name = type + '-disconnected';
        };
    }
});


//
let manager;
let watchdog;

// TODO: figure out how to use these proper
function init() {
    debug('initializing extension');
    
    // ?
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
    Settings.connect('changed', settingsChanged);
};
 
function disable() {
    debug('disabling extension');
    
    // Stop watching for DBus Service
    Gio.bus_unwatch_name(watchdog);
    
    // Stop watching 'start-daemon' setting
    // ERROR: gsignal.c:2641: instance '0x55d236fa6610' has no handler with id '9223372036854775808'
    //Settings.disconnect('start-daemon');
    
    //
    if (manager != null) {
        let devicePaths = Object.keys(manager.devices);
    
        for (let devicePath in devicePaths) {
            removeIndicator(devicePaths[devicePath]);
        };
    
        manager.devices = {};
        manager.proxy = null;
        manager = null;
    };
};
    
// Methods
function addIndicator(devicePath) {
    debug('addIndicator() called on ' + devicePath);
    
    if (!Main.panel.statusArea[devicePath]) {
        let device = manager.devices[devicePath];
        let indicator = new Indicator(device);
        Main.panel.addToStatusArea(devicePath, indicator);
    };
};

function removeIndicator(devicePath) {
    debug('removeIndicator() called on ' + devicePath);
    
    if (Main.panel.statusArea[devicePath]) {
        let indicator = Main.panel.statusArea[devicePath];
        indicator.disable();
    };
};

// DBus Watchdog Callbacks
function daemonAppeared(conn, name, name_owner, user_data) {
    // The DBus interface has appeared, setup
    debug('daemonAppeared() called');
    
    manager = new MConnect.DeviceManager();

    // TODO: GSettings option for what states to show devices
    // TODO: GSettings option for indicator when no device present
    for (let devicePath in manager.devices) {
        let device = manager.devices[devicePath];
        
        if (device.active) {
            addIndicator(devicePath);
        };
    };
};

function daemonVanished(conn, name, name_owner, user_data) {
    // The DBus interface has vanished
    debug('daemonVanished() called');
    
    // If a manager is initialized, clear it
    if (manager != null) {
        let devicePaths = Object.keys(manager.devices);
    
        for (let devicePath in devicePaths) {
            removeIndicator(devicePaths[devicePath]);
        };
    
        manager.devices = {};
        manager.proxy = null;
        manager = null;
    }
    
    // Start the manager
    if (Settings.get_boolean('start-daemon')) {
        MConnect.startDaemon();
    } else {
        log('waiting for daemon');
    };
};

function settingsChanged(settings, key, user_data) {
    // If 'start-daemon' was enabled and mconnect is not running, start it
    if (key == 'start-daemon') {
        debug('start-daemon changed');
        
        if (Settings.get_boolean(key) && manager == null) {
            MConnect.startDaemon();
        };
    };
};



