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
        this.menuDeviceItem = new PopupMenu.PopupMenuItem(this.device.name, {activate: true, reactive: true});
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
        
        //// SMS Item
        this.menuSMSItem = new PopupMenu.PopupMenuItem("Send SMS..", {activate: false, reactive: true});
        this.menu.addMenuItem(this.menuSMSItem);

        //// Ping Item
        this.menuPingItem = new PopupMenu.PopupMenuItem("Send Ping..", {activate: true, reactive: true});
        this.menuPingItem.connect(
            'activate',
            Lang.bind(
                this,
                function (deviceItem) {
                    //this.menuPingDialog.open();
                }
            )
        );
        this.menu.addMenuItem(this.menuPingItem);
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


// A Re-Wrapper for mconnect.DeviceManager
const Extension = new Lang.Class({
    Name: 'Extension',

    _init: function () {
        // Watch for DBus service
        this.watchdog = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            'org.mconnect',
            Gio.BusNameWatcherFlags.NONE,
            Lang.bind(this, this._daemonAppeared),
            Lang.bind(this, this._daemonVanished)
        );
        
        // Settings callback
        Settings.connect(
            'changed',
            Lang.bind(this, this._settingsChanged)
        );
        
        // Signal Callbacks
        //this.manager.connect('manager::signal', Lang.bind(this, this._managerCallback));
    },
    
    // Private Methods
    _addIndicator: function (devicePath) {
        debug('_addIndicator() called on ' + devicePath);
        
        if (!Main.panel.statusArea[devicePath]) {
            let device = this.manager.devices[devicePath];
            let indicator = new Indicator(device);
            Main.panel.addToStatusArea(devicePath, indicator);
        };
    },
    
    _removeIndicator: function (devicePath) {
        debug('_removeIndicator() called on ' + devicePath);
        
        if (Main.panel.statusArea[devicePath]) {
            let indicator = Main.panel.statusArea[devicePath];
            indicator.disable();
        };
    },
    
    // Callbacks
    _daemonAppeared: function (conn, name, name_owner, user_data) {
        // The DBus interface has appeared, setup
        debug('_daemonAppeared() called');
        
        try {
            this.manager = new MConnect.DeviceManager();
        
            // TODO: GSettings option for what states to show devices
            // TODO: GSettings option for indicator when no device present
            for (let devicePath in this.manager.devices) {
                let device = this.manager.devices[devicePath];
                
                if (device.active) {
                    this._addIndicator(devicePath);
                };
            };
        } catch (e) {
            throw new Error(e);
        };
    },
    
    _daemonVanished: function (conn, name, name_owner, user_data) {
        // The DBus interface has vanished
        debug('_daemonVanished() called');
        
        // If a manager is initialized, clear it
        if (this.manager != null) {
            let devicePaths = Object.keys(this.manager.devices);
        
            for (let devicePath in devicePaths) {
                this._removeIndicator(devicePaths[devicePath]);
            };
        
            this.manager.devices = {};
            this.manager.proxy = null;
            this.manager = null;
        }
        
        if (Settings.get_boolean('start-daemon')) {
            MConnect.startDaemon();
        };
    },
    
    _settingsChanged: function (settings, key, user_data) {
        // If 'start-daemon' was enabled and mconnect is not running, start it
        if (key == 'start-daemon') {
            debug('start-daemon changed');
            
            if (Settings.get_boolean(key) && this.manager == null) {
                MConnect.startDaemon();
            };
        };
    },
    
    // Extension stuff?
    enable: function () {
    },
    
    disable: function () {
    }
});

// TODO: figure out how to use these proper
function init() {
    debug('initializing extension');
    
    // ?
}
 
function enable() {
    debug('enabling extension');
    
    var extension = new Extension();
    return extension;
}
 
function disable() {
    debug('disabling extension');
    
    extension = null;
}



