"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Main = imports.ui.main;
const Util = imports.misc.util;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, assert, Settings } = Me.imports.prefs;


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
    log("spawning mconnect daemon");
    
    try {
        Util.spawnCommandLine("mconnect -d");
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("mconnect.startDaemon: " + e);
    }
}


// Start the backend settings
function startSettings() {
    log("spawning mconnect settings");
    
    try {
        Util.spawn(["gnome-shell-extension-prefs", Me.metadata.uuid]);
        GLib.usleep(10000); // 10ms
    } catch (e) {
        debug("mconnect.startSettings: " + e);
    }
}


// A DBus Interface wrapper for the battery plugin
const Battery = new Lang.Class({
    Name: "Battery",
    
    _init: function (device) {
        debug("mconnect.Battery._init(" + device.busPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new BatteryProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.busPath
        );
        
        // Properties
        this.device = device;
        
        Object.defineProperties(this, {
            charging: { value: this.proxy.Charging },
            level: { value: this.proxy.Level }
        });
        
        // Signals
        this.proxy.connectSignal("Battery", Lang.bind(this, this._Battery));
    },
    
    // MConnect Callbacks
    _Battery: function (proxy, sender, level_charging) {
        debug("mconnect.Battery._Battery(): " + level_charging);
                    
        this._level = level_charging[0];
        this._charging = level_charging[1];
        // have the device re-emit the signal
        this.device.emit("changed::battery", null, level_charging);
    },
    
    // Public Methods
    destroy: function () {
        // TODO: disconnect signals
        delete this.proxy;
    }
});

Signals.addSignalMethods(Battery.prototype);

// A DBus Interface wrapper for the ping plugin
const Ping = new Lang.Class({
    Name: "Ping",
    
    _init: function (device) {
        debug("mconnect.Ping._init(" + device.busPath + ")");
        
        // Create proxy for the DBus Interface
        this.proxy = new PingProxy(
            Gio.DBus.session,
            BUS_NAME,
            device.busPath
        );
        
        // Properties
        this.device = device;
        
        // Signals
        this.proxy.connectSignal("Ping", Lang.bind(this, this._Ping));
    },
    
    // MConnect Callbacks
    _Ping: function (proxy, sender) {
        debug("mconnect.Ping._Ping()");
        
        // have the device re-emit the signal
        this.device.emit("received::ping", null);
    },
    
    // Public Methods
    destroy: function () {
        // TODO: disconnect signals
        delete this.proxy;
    }
});

Signals.addSignalMethods(Ping.prototype);

// Our supported plugins mapping
const Plugins = {
    "battery": Battery,
    "ping": Ping
};


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    
    _init: function (busPath) {
        // Create proxy for the DBus Interface
        this.proxy = new DeviceProxy(Gio.DBus.session, BUS_NAME, busPath);
        
        // Properties
        this.busPath = busPath;
        this.plugins = {};
        
        Object.defineProperties(this, {
            id: { value: this.proxy.Id },
            name: { value: this.proxy.Name },
            type: { value: this.proxy.DeviceType },
            version: { value: this.proxy.ProtocolVersion }, // TODO: not a kdeconnect property
            address: { value: this.proxy.Address }, // TODO: not a kdeconnect property
            paired: { value: this.proxy.IsPaired }, // TODO: not a kdeconnect property
            allowed: { value: this.proxy.Allowed }, // TODO: this is actually changeable
            active: { value: this.proxy.isActive }, // kdeconnect: reachable
            incomingCapabilities: { value: this.proxy.IncomingCapabilities },
            outgoingCapabilities: { value: this.proxy.OutgoingCapabilities }
        });
        
        // Plugins
        this._initPlugins();
        
        // TODO: Signals
        //this.proxy.connectSignal("initPlugins", Lang.bind(this, this._initPlugins));
    },
    
    // MConnect Callbacks
    _initPlugins: function (proxy, sender, cb_data) {
        // NOTE: not actually a signal yet
        debug("mconnect.Device._initPlugins()");
        
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
        
        delete this.proxy;
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
        for (let busPath of this._ListDevices()) {
            this._deviceAdded(this, null, busPath);
        }
        
        // TODO: Signals
        //this.proxy.connectSignal("deviceAdded", Lang.bind(this, this._deviceAdded));
        //this.proxy.connectSignal("deviceRemoved", Lang.bind(this, this._deviceRemoved));
        //this.proxy.connectSignal("deviceVisibilityChanged", Lang.bind(this, this._deviceVisibilityChanged));
    },
    
    // MConnect Callbacks
    _deviceAdded: function (manager, signal_id, busPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceAdded(" + busPath + ")");
        
        this.devices[busPath] = new Device(busPath);
        this.emit("device::added", null, busPath);
    },
    
    _deviceRemoved: function (manager, signal_id, busPath) {
        // NOTE: not actually a signal yet
        debug("mconnect.DeviceManager._deviceRemoved(" + busPath + ")");
        
        this.devices[busPath].destroy();
        delete this.devices[busPath];
        this.emit("device::removed", null, busPath);
    },
    
    // MConnect Methods
    _AllowDevice: function (busPath) {
        // Mark the device at *busPath* as allowed
        debug("mconnect.DeviceManager._AllowDevice()");
        
        return this.proxy.AllowDeviceSync(busPath);
    },
    
    _ListDevices: function () {
        // Return an array in an array of device DBus paths
        debug("mconnect.DeviceManager._ListDevices()");
        
        return this.proxy.ListDevicesSync()[0];
    },
    
    // Public Methods
    destroy: function () {
        for (let busPath in this.devices) {
            this._deviceRemoved(this, null, busPath);
        }
    }
});

Signals.addSignalMethods(DeviceManager.prototype);

