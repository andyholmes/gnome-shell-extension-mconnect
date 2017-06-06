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
const { log, debug, getSettings } = Me.imports.utils;
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
            this.icon.icon_name = type + '-connected';
        };
    }
});


// A Re-Wrapper for mconnect.DeviceManager
const Extension = new Lang.Class({
    Name: 'mconnect.Extension',

    _init: function () {
        this._settings = getSettings();
        
        // Init a DeviceManager
        this.manager = new MConnect.DeviceManager();        
        this.devices = this.manager.devices;
        
        // Signal Callbacks
        this.manager.connect('daemon-connected', Lang.bind(this, this._daemonConnected));
        this.manager.connect('daemon-disconnected', Lang.bind(this, this._daemonDisconnected));
    },
    
    // Private Methods
    _addIndicator: function (devicePath) {
        debug('_addIndicator() called on ' + devicePath);
        
        if (!Main.panel.statusArea[devicePath]) {
            let device = this.devices[devicePath];
            let indicator = new Indicator(device);
            Main.panel.addToStatusArea(devicePath, indicator);
        };
    },
    
    _removeIndicator: function (devicePath) {
        debug('_removeIndicator() called on ' + devicePath);
        
        if (Main.panel.statusArea[devicePath]) {
            let indicator = Main.panel.statusArea[devicePath];
            indicator.disable();
            indicator.destroy();
        };
    },
    
    // Callbacks
    _daemonConnected: function (manager, devices) {
        // TODO: GSettings option for what states to show devices
        // TODO: GSettings option for indicator when no device present
        this.devices = devices;
        
        for (let devicePath in this.devices) {
            let device = this.devices[devicePath];
            
            if (device.active) {
                this._addIndicator(devicePath);
            };
        };
    },
    
    _daemonDisconnected: function (manager, devicePaths) {
        // FIXME: passing devicePaths through like this seems sketchy
        debug('removing all indicators');
        for (let devicePath in devicePaths) {
            this._removeIndicator(devicePaths[devicePath]);
        };
        
        this.devices = null;
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
    
    return new Extension();
}
 
function enable() {
    debug('enabling extension');
}
 
function disable() {
    debug('disabling extension');
}



