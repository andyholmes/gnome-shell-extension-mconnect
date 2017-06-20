"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Local Imports
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_path();
}

imports.searchPath.push(getPath());
const { debug, Settings } = imports.utils;


// DBus Constants
const BUS_NAME = "org.mconnect";

const ManagerProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.DeviceManager"> \
    <method name="AllowDevice"> \
      <arg type="s" name="path" direction="in"/> \
    </method> \
    <method name="ListDevices"> \
      <arg type="ao" name="result" direction="out"/> \
    </method> \
  </interface> \
</node> \
');

const DeviceProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.Device"> \
    <property type="s" name="Id" access="readwrite"/> \
    <property type="s" name="Name" access="readwrite"/> \
    <property type="s" name="DeviceType" access="readwrite"/> \
    <property type="u" name="ProtocolVersion" access="readwrite"/> \
    <property type="s" name="Address" access="readwrite"/> \
    <property type="b" name="IsPaired" access="readwrite"/> \
    <property type="b" name="Allowed" access="readwrite"/> \
    <property type="b" name="IsActive" access="readwrite"/> \
    <property type="as" name="IncomingCapabilities" access="readwrite"/> \
    <property type="as" name="OutgoingCapabilities" access="readwrite"/> \
  </interface> \
</node> \
');


// Plugins
const BatteryProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.Device.Battery"> \
    <signal name="Battery"> \
      <arg type="u" name="level"/> \
      <arg type="b" name="charging"/> \
    </signal> \
    <property type="u" name="Level" access="readwrite"/> \
    <property type="b" name="Charging" access="readwrite"/> \
  </interface> \
</node> \
');

const PingProxy = Gio.DBusProxy.makeProxyWrapper('\
<!DOCTYPE node PUBLIC "-//freedesktop//DTD D-BUS Object Introspection 1.0//EN" \
"http://www.freedesktop.org/standards/dbus/1.0/introspect.dtd"> \
<node> \
  <interface name="org.mconnect.Device.Ping"> \
    <signal name="Ping"> \
    </signal> \
  </interface> \
</node> \
');


// Start the backend daemon
function startDaemon() {
    debug("spawning mconnect daemon");
    
    try {
        GLib.spawn_command_line_async("mconnect -d");
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("mconnect.startDaemon(): " + e);
    }
}


// Start the backend settings
function startSettings() {
    debug("spawning mconnect settings");
    
    try {
        GLib.spawn_command_line_async(
            "gnome-shell-extension-prefs mconnect@andyholmes.github.io"
        );
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("mconnect.startSettings(): " + e);
    }
}


// A DBus Interface wrapper for the battery plugin
const Battery = new Lang.Class({
    Name: "Battery",
    
    _init: function (device) {
        debug("mconnect.Battery._init(" + device.dbusPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new BatteryProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.dbusPath
        );
        
        // Properties
        this.device = device;
        
        Object.defineProperties(this, {
            charging: { value: this.proxy.Charging },
            level: { value: this.proxy.Level }
        });
        
        // MConnect Signals
        this.proxy.connectSignal("Battery", (proxy, sender, levelCharging) => {
            // have the device re-emit the signal
            this.device.emit("changed::battery", levelCharging);
        });
    },
    
    // Public Methods
    destroy: function () {
        this.proxy._signalConnections.forEach((connection) => { 
            this.proxy.disconnectSignal(connection.id);
        });
        
        delete this.proxy;
    }
});

// A DBus Interface wrapper for the ping plugin
const Ping = new Lang.Class({
    Name: "Ping",
    
    _init: function (device) {
        debug("mconnect.Ping._init(" + device.dbusPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new PingProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.dbusPath
        );
        
        // Properties
        this.device = device;
        
        // MConnect Signals
        this.proxy.connectSignal("Ping", (proxy, sender) => {
            // have the device re-emit the signal
            this.device.emit("received::ping", null);
        });
    },
    
    // Public Methods
    destroy: function () {
        this.proxy._signalConnections.forEach((connection) => { 
            this.proxy.disconnectSignal(connection.id);
        });
        
        delete this.proxy;
    }
});

// Our supported plugins mapping
const Plugins = {
    "battery": Battery,
    "ping": Ping
};


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    
    _init: function (dbusPath) {
        // Create proxy for the DBus Interface
        this.proxy = new DeviceProxy(Gio.DBus.session, BUS_NAME, dbusPath);
        
        // Properties
        this.dbusPath = dbusPath;
        this.plugins = {};
        
        Object.defineProperties(this, {
            id: { value: this.proxy.Id },
            name: { value: this.proxy.Name },
            type: { value: this.proxy.DeviceType },
            trusted: { value: this.proxy.Allowed }, // TODO: get/set
            active: { value: this.proxy.IsActive }, // kdeconnect: reachable
            // TODO: still not clear on these two
            incomingCapabilities: { value: this.proxy.IncomingCapabilities },
            outgoingCapabilities: { value: this.proxy.OutgoingCapabilities }
            // TODO: the following aren't kdeconnect properties
            //address: { value: this.proxy.Address },
            //paired: { value: this.proxy.IsPaired },
            //version: { value: this.proxy.ProtocolVersion }
        });
        
        // Plugins
        this._pluginsChanged();
        
        // TODO: Signals
        //this.proxy.connectSignal("pluginsChanged", Lang.bind(this, this._pluginsChanged));
    },
    
    // MConnect Callbacks
    _pluginsChanged: function (proxy, sender, cb_data) {
        // NOTE: not actually a signal yet
        debug("mconnect.Device._pluginsChanged()");
        
        this.plugins = {};
        
        for (let pluginName of this.outgoingCapabilities) {
            pluginName = pluginName.substring(11);
            
            if (Plugins.hasOwnProperty(pluginName)) {
                this.plugins[pluginName] = new Plugins[pluginName](this);
            }
        }
        
        this.emit("changed::plugins", null);
    },
    
    // Public Methods
    destroy: function () {
        for (let pluginName in this.plugins) {
            this.plugins[pluginName].destroy();
            delete this.plugins[pluginName];
        }
        
        // TODO: no signals yet
        //this.proxy._signalConnections.forEach((connection) => { 
        //    this.proxy.disconnectSignal(connection.id);
        //});
        delete this.proxy;
        
        this.disconnectAll();
    }
});

Signals.addSignalMethods(Device.prototype);


// A DBus Interface wrapper for a device manager
const DeviceManager = new Lang.Class({
    Name: "DeviceManager",
    
    devices: {},
    
    _init: function () {
        // Create proxy wrapper for DBus Interface
        this.proxy = new ManagerProxy(
            Gio.DBus.session,
            BUS_NAME,
            "/org/mconnect/manager"
        );
        
        // Properties
        Object.defineProperties(this, {
            name: {
                get: function () {
                    // TODO: this is actually a read/write property for KDE 
                    // Connect but mconnect always reports username@hostname.
                    return GLib.get_user_name() + "@" + GLib.get_host_name();
                }
            }
        });
        
        // Add currently managed devices
        this._ListDevices().forEach((dbusPath) => {
            this._deviceAdded(this, dbusPath);
        });
        
        // TODO: Signals
    },
    
    // MConnect Callbacks
    _deviceAdded: function (manager, dbusPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceAdded(" + dbusPath + ")");
        
        this.devices[dbusPath] = new Device(dbusPath);
        this.emit("device::added", null, dbusPath);
    },
    
    _deviceRemoved: function (manager, dbusPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceRemoved(" + dbusPath + ")");
        
        this.devices[dbusPath].destroy();
        delete this.devices[dbusPath];
        this.emit("device::removed", null,  dbusPath);
    },
    
    // MConnect Methods
    _AllowDevice: function (dbusPath) {
        // Mark the device at *dbusPath* as allowed
        debug("mconnect.DeviceManager._AllowDevice(" + dbusPath + ")");
        
        return this.proxy.AllowDeviceSync(dbusPath);
    },
    
    _ListDevices: function () {
        // Return an array in an array of device DBus paths
        debug("mconnect.DeviceManager._ListDevices()");
        
        return this.proxy.ListDevicesSync()[0];
    },
    
    // Public Methods
    trustDevice: function (dbusPath) {
        // We're going to do it the MConnect way with dbusPath's
        debug("mconnect.DeviceManager.trustDevice(" + dbusPath + ")");
        
        this._AllowDevice(dbusPath);
    },
    
    untrustDevice: function (dbusPath) {
        // We're going to do it the MConnect way with dbusPath's
        debug("mconnect.DeviceManager.untrustDevice(" + dbusPath + ")");
        
        debug("mconnect.DeviceManager.untrustDevice(): Not implemented");
    },
    
    destroy: function () {
        for (let dbusPath in this.devices) {
            this._deviceRemoved(this, dbusPath);
        }
        
        // TODO: no signals yet
        //this.proxy._signalConnections.forEach((connection) => { 
        //    this.proxy.disconnectSignal(connection.id);
        //});
        delete this.proxy
        
        this.disconnectAll();
    }
});

Signals.addSignalMethods(DeviceManager.prototype);

