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
//const Telepathy = imports.ui.components.telepathyClient

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, getSettings } = Me.imports.utils;
const MConnect = Me.imports.mconnect;


// FIXME: reuse ui.components.telepathyClient if possible
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
        debug('initializing');
        
        this._settings = getSettings();
        
        // Init a DeviceManager
        this.manager = new MConnect.DeviceManager();        
        this.devices = this.manager.devices;
        
        // Init indicators for reachable devices
        for (let devicePath in this.devices) {
            let device = this.devices[devicePath];
            
            if (device.active) {
                this._addIndicator(devicePath);
            };
        };
        
        // Signal Callbacks
        //this.manager.connect('manager::signal', Lang.bind(this, this._managerCallback));
    },
    
    // Private Methods
    _removeIndicator: function (devicePath) {
        debug('_removeIndicator() called on ' + devicePath);
        
        if (Main.panel.statusArea[devicePath]) {
            let indicator = Main.panel.statusArea[devicePath];
            indicator.disable();
            indicator.destroy();
        };
    },
    
    _addIndicator: function (devicePath) {
        debug('_addIndicator() called on ' + devicePath);
        
        if (!Main.panel.statusArea[devicePath]) {
            let device = this.devices[devicePath];
            let indicator = new Indicator(device);
            Main.panel.addToStatusArea(devicePath, indicator);
        };
    },
    
    // Callbacks
    //_managerCallback: function (manager, data) {
    //    debug('_managerCallback "' + data + '"');
    //},
    
    // Extension stuff?
    enable: function () {
    },
    
    disable: function () {
    }
});


function init() {
    // FIXME
    debug('initializing');
    
    return new Extension();
}
 
function enable() {
    // FIXME
    debug('enabling');
}
 
function disable() {
    // FIXME
    debug('disabling');
}



