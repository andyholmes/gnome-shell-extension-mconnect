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

const PropertiesProxy = Gio.DBusProxy.makeProxyWrapper('\
<node> \
  <interface name="org.freedesktop.DBus.Properties"> \
    <method name="Get"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="s" name="property_name" direction="in"/> \
      <arg type="v" name="value" direction="out"/> \
    </method> \
    <method name="GetAll"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="a{sv}" name="properties" direction="out"/> \
    </method> \
    <method name="Set"> \
      <arg type="s" name="interface_name" direction="in"/> \
      <arg type="s" name="property_name" direction="in"/> \
      <arg type="v" name="value" direction="in"/> \
    </method> \
    <signal name="PropertiesChanged"> \
      <arg type="s" name="interface_name"/> \
      <arg type="a{sv}" name="changed_properties"/> \
      <arg type="as" name="invalidated_properties"/> \
    </signal> \
  </interface> \
</node> \
');

// Plugins
const BatteryProxy = Gio.DBusProxy.makeProxyWrapper('\
<node> \
  <interface name="org.mconnect.Device.Battery"> \
    <property type="u" name="Level" access="readwrite"/> \
    <property type="b" name="Charging" access="readwrite"/> \
  </interface> \
</node> \
');

const PingProxy = Gio.DBusProxy.makeProxyWrapper('\
<node> \
  <interface name="org.mconnect.Device.Ping"> \
    <signal name="Ping"> \
    </signal> \
  </interface> \
</node> \
');

const DeviceXML = '\
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
';

const DeviceManagerXML = '\
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
';


// Plugins
const BatteryXML = '\
<node> \
  <interface name="org.mconnect.Device.Battery"> \
    <property type="u" name="Level" access="readwrite"/> \
    <property type="b" name="Charging" access="readwrite"/> \
  </interface> \
</node> \
';

const PingXML = '\
<node> \
  <interface name="org.mconnect.Device.Ping"> \
    <signal name="Ping"> \
    </signal> \
  </interface> \
</node> \
';

const Interface = {
    DEVICE: new Gio.DBusNodeInfo.new_for_xml(DeviceXML).interfaces[0],
    MANAGER: new Gio.DBusNodeInfo.new_for_xml(DeviceManagerXML).interfaces[0],
    BATTERY: new Gio.DBusNodeInfo.new_for_xml(BatteryXML).interfaces[0],
    PING: new Gio.DBusNodeInfo.new_for_xml(PingXML).interfaces[0]
};


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
            charging: { get: () => {
                if (typeof this.proxy.Charging === "boolean") {
                    return this.proxy.Charging;
                }
                
                debug("NON BOOLEAN CHARGING");
                return false;
            }},
            level: { value: this.proxy.Level }
        });
    },
    
    // Public Methods
    destroy: function () {
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

Signals.addSignalMethods(Ping.prototype);

// Our supported plugins mapping
const Plugins = {
    "battery": Battery,
    "ping": Ping
};


const ProxyBase = new Lang.Class({
    Name: "ProxyBase",
    Extends: Gio.DBusProxy,
    
    _init: function (iface, dbusPath) {
        this.parent({
            gConnection: Gio.DBus.session,
            gInterfaceInfo: iface,
            gName: BUS_NAME,
            gObjectPath: dbusPath,
            gInterfaceName: iface.name
        });
        
        this.cancellable = new Gio.Cancellable();
        this.init(null);
        
        // Create proxy for the DBus Interface
        this.props = new PropertiesProxy(Gio.DBus.session, BUS_NAME, dbusPath);
        
        // Properties
        this.dbusPath = dbusPath;
    }
});

Signals.addSignalMethods(ProxyBase.prototype);


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    Extends: ProxyBase,
    
    _init: function (dbusPath) {
        this.parent(Interface.DEVICE, dbusPath);
        
        // Properties
        this.plugins = {};
        
        Object.defineProperties(this, {
            address: { get: () => { return this._getProp("Address"); } },
            id: { get: () => { return this._getProp("Id"); } },
            type: { get: () => { return this._getProp("DeviceType"); } },
            name: { get: () => { return this._getProp("Name"); } },
            active: { get: () => { return this._getProp("IsActive"); } }, // paired, trusted & connected
            paired: { get: () => { return this._getProp("IsPaired"); } },
            trusted: { get: () => { return this._getProp("Allowed"); } }, // TODO: get/set
            // TODO: still not clear on these two
            incomingCapabilities: { get: () => { return this._getProp("IncomingCapabilities"); } },
            outgoingCapabilities: { get: () => { return this._getProp("OutgoingCapabilities"); } },
            version:{ get: () => { return this._getProp("ProtocolVersion"); } },
        });
        
        // Plugins
        this._pluginsChanged();
        
        // Signals
        this.props.connectSignal("PropertiesChanged",
            (proxy, sender, data) => {
                let [iface, params] = data;
                
                if (iface === "org.mconnect.Device") {
                    if (params.hasOwnProperty("Name")) {
                        this.emit("changed::name", this.name);
                    }
                    
                    if (params.hasOwnProperty("Allowed")) {
                        this.emit("changed::trusted", this.trusted);
                    }
                    
                    if (params.hasOwnProperty("IsActive")) {
                        this.emit("changed::active", this.active);
                    }
                } else if (iface === "org.mconnect.Device.Battery") {
                    this.emit(
                        "changed::battery",
                        this.plugins.battery.level,
                        this.plugins.battery.charging
                    );
                }
            }
        );
    },
    
    // wrapper funcs
    connect_: function (proxy, sender_name, signal_name, parameters) {
        Signals._emit.call(proxy, signal_name, sender_name, parameters.deep_unpack());
    },
    
    _getProp: function (name) {
        let value = this.get_cached_property(name);
        return value ? value.deep_unpack() : null;
    },

    _setProp: function (value, name, signature) {
        let variant = new GLib.Variant(signature, value);
        this.set_cached_property(name, variant);

        this.call(
            'org.freedesktop.DBus.Properties.Set',
            new GLib.Variant(
                '(ssv)',
                [this.g_interface_name, name, variant]
            ),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            (proxy, result) => {
                try {
                    this.call_finish(result);
                } catch (e) {
                    log('Could not set property ' + name + ' on remote object ' +
                        this.g_object_path + ': ' + e.message);
                }
            }
        );
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


// A DBus Interface wrapper for a device manager
const DeviceManager = new Lang.Class({
    Name: "DeviceManager",
    Extends: ProxyBase,
    
    _init: function () {
        this.parent(Interface.MANAGER, "/org/mconnect/manager");
        
        // Properties
        this.devices = {};
        
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
        
        return this.call_sync(
            "AllowDevice",
            new GLib.Variant('(s)', dbusPath),
            Gio.DBusCallFlags.NONE,
            -1,
            this.cancellable
        ).deep_unpack()[0];
    },
    
    _ListDevices: function () {
        debug("mconnect.DeviceManager._ListDevices()");
        
        return this.call_sync(
            "ListDevices",
            new GLib.Variant('()', ''),
            Gio.DBusCallFlags.NONE,
            -1,
            this.cancellable
        ).deep_unpack()[0];
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
        delete this.proxy;
        
        this.disconnectAll();
    }
});

