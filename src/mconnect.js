"use strict";

// Imports
const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { log, debug, assert, Settings } = Me.imports.lib;


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


const DeviceNode = new Gio.DBusNodeInfo.new_for_xml('\
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
    <property type="b" name="IsConnected" access="readwrite"/> \
    <property type="as" name="IncomingCapabilities" access="readwrite"/> \
    <property type="as" name="OutgoingCapabilities" access="readwrite"/> \
  </interface> \
  <interface name="org.mconnect.Device.Battery"> \
    <property type="u" name="Level" access="readwrite"/> \
    <property type="b" name="Charging" access="readwrite"/> \
  </interface> \
  <interface name="org.mconnect.Device.Ping"> \
    <signal name="Ping"> \
    </signal> \
  </interface> \
</node> \
');


const ManagerNode = new Gio.DBusNodeInfo.new_for_xml('\
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


const Interface = {
    DEVICE: DeviceNode.interfaces[0],
    BATTERY: DeviceNode.interfaces[1],
    PING: DeviceNode.interfaces[2],
    MANAGER: ManagerNode.interfaces[0]
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


// Open the extension preferences window
function startPreferences() {
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


const ProxyBase = new Lang.Class({
    Name: "ProxyBase",
    Extends: Gio.DBusProxy,
    
    _init: function (iface, dbusPath, props) {
        this.parent({
            gConnection: Gio.DBus.session,
            gInterfaceInfo: iface,
            gName: BUS_NAME,
            gObjectPath: dbusPath,
            gInterfaceName: iface.name
        });
        
        this.cancellable = new Gio.Cancellable();
        this.init(null);
        
        // Create an org.freedesktop.DBus.Properties interface
        if (props === true) {
            this.props = new PropertiesProxy(
                Gio.DBus.session,
                BUS_NAME,
                dbusPath
            );
        }
    },
    
    // Wrapper functions
    _call: function (name, variant, callback) {
        debug("mconnect.ProxyBase._call(" + name + ")");
        
        let ret;
        
        if (typeof callback === "function" || callback === true) {
            this.call(
                name,
                variant,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (proxy, result) => {
                    try {
                        ret = this.call_finish(result);
                        
                        if (typeof callback === "function") {
                            callback(ret);
                        }
                    } catch (e) {
                        log("Error calling " + name + ": " + e.message);
                    }
                }
            );
        } else {
            ret = this.call_sync(
                name,
                variant,
                Gio.DBusCallFlags.NONE,
                -1,
                this.cancellable
            );
        }
        
        return (ret) ? ret.deep_unpack()[0] : null;
    },
    
    _get: function (name) {
        let value = this.get_cached_property(name);
        return value ? value.deep_unpack() : null;
    },

    _set: function (name, value, signature) {
        let variant = new GLib.Variant(signature, value);
        this.set_cached_property(name, variant);

        this.call(
            'org.freedesktop.DBus.Properties.Set',
            new GLib.Variant('(ssv)', [this.gInterfaceName, name, variant]),
            Gio.DBusCallFlags.NONE,
            -1,
            this.cancellable,
            (proxy, result) => {
                try {
                    this.call_finish(result);
                } catch (e) {
                    log('Error setting ' + name + ' on ' + this.gObjectPath +
                        ': ' + e.message
                    );
                }
            }
        );
    },
    
    destroy: function () {
        // TODO
        this.disconnectAll();
        delete this.props;
    }
});

Signals.addSignalMethods(ProxyBase.prototype);


// Our supported plugins mapping
const Plugins = {
    "battery": Interface.BATTERY,
    "ping": Interface.PING,
    "telephony": Interface.PING
};


// A DBus Interface wrapper for a device
const Device = new Lang.Class({
    Name: "Device",
    Extends: ProxyBase,
    
    _init: function (dbusPath) {
        this.parent(Interface.DEVICE, dbusPath, true);
        
        // Properties
        this.plugins = {};
        
        Object.defineProperties(this, {
            // Static Properties
            address: { get: () => { return this._get("Address"); } },
            version: { get: () => { return this._get("ProtocolVersion"); } },
            id: { get: () => { return this._get("Id"); } },
            type: { get: () => { return this._get("DeviceType"); } },
            // Dynamic Immutable Properties
            name: { get: () => { return this._get("Name"); } },
            active: { get: () => { return (this._get("IsActive") === true); } },
            connected: { get: () => { return (this._get("IsConnected") === true); } },
            paired: { get: () => { return (this._get("IsPaired") === true); } },
            // TODO: still not clear on these two
            incomingCapabilities: { get: () => { return this._get("IncomingCapabilities"); } },
            outgoingCapabilities: { get: () => { return this._get("OutgoingCapabilities"); } },
            // Dynamic Mutable Properties
            allowed: { get: () => { return (this._get("Allowed") === true); } },
            
            // Plugin Properties
            charging: { get: () => { return this.plugins.battery._get("Charging"); } },
            level: { get: () => { return this.plugins.battery._get("Level"); } }
        });
        
        // Plugins
        this._pluginsChanged();
        
        // Signals
        this.props.connectSignal("PropertiesChanged",
            (proxy, sender, data) => {
                let [iface, props, user_data] = data;
                
                // Unpack the properties
                for (let name in props) {
                    props[name] = props[name].deep_unpack();
                }
                
                if (iface === "org.mconnect.Device") {
                    if (props.hasOwnProperty("Name")) {
                        this.emit(
                            "changed::name",
                            props["Name"] || this.name
                        );
                    }
                    
                    if (props.hasOwnProperty("Allowed")) {
                        this.emit(
                            "changed::allowed",
                            props["Allowed"] || this.allowed
                        );
                    }
                    
                    if (props.hasOwnProperty("IsPaired")) {
                        this.emit(
                            "changed::paired",
                            props["IsPaired"] || this.paired
                        );
                    }
                    
                    if (props.hasOwnProperty("IsActive")) {
                        this.emit(
                            "changed::active",
                            props["IsActive"] || this.active
                        );
                    }
                    
                    if (props.hasOwnProperty("IsConnected")) {
                        this.emit(
                            "changed::connected", 
                            props["IsConnected"] || this.connected
                        );
                    }
                    
                    if (props.hasOwnProperty("IncomingCapabilities")) {
                        this._pluginsChanged(this, this.plugins);
                    } else if (props.hasOwnProperty("OutgoingCapabilities")) {
                        this._pluginsChanged(this, this.plugins);
                    }
                } else if (iface === "org.mconnect.Device.Battery") {
                    // Sometimes we get a battery packet before the plugin
                    if (this.plugins.hasOwnProperty("battery")) {
                        this.emit(
                            "changed::battery",
                            props["Level"] || this.level,
                            props["Charging"] || this.charging
                        );
                    }
                }
            }
        );
    },
    
    // Callbacks
    _pluginsChanged: function (proxy, sender, cb_data) {
        // NOTE: not actually a signal yet
        // TODO: better
        debug("mconnect.Device._pluginsChanged()");
        
        this.plugins = {};
        
        for (let pluginName of this.outgoingCapabilities) {
            switch (pluginName) {
                case "kdeconnect.battery":
                    this.plugins.battery = new ProxyBase(
                        Interface.BATTERY,
                        this.gObjectPath,
                        false
                    );
                    break;
                case "kdeconnect.ping":
                    this.plugins.ping = new ProxyBase(
                        Interface.PING,
                        this.gObjectPath,
                        false
                    );
                    
                    this.plugins.ping.connectSignal(
                        "Ping",
                        (proxy, sender, data) => {
                            this.emit("received::ping", null)
                        }
                    );
                    
                    break;
            }
        }
        
        for (let pluginName of this.incomingCapabilities) {
            switch (pluginName) {
                case "kdeconnect.findmyphone.request":
                    this.plugins.findmyphone = new ProxyBase(
                        Interface.PING, // TODO
                        this.gObjectPath,
                        true
                    );
                    
                    break;
                case "kdeconnect.sms.request":
                    this.plugins.sms = new ProxyBase(
                        Interface.PING, // TODO
                        this.gObjectPath,
                        true
                    );
                    
                    break;
            }
        }
        
        this.emit("changed::plugins", null);
    },
    
    // Plugin Methods
    ring: function () {
        // TODO: findyphone is not supported yet
        debug("mconnect.Device.ring()");
        
//        this._call(
//            "org.mconnect.Device.FindMyPhone.Ring",
//            new GLib.Variant("()", ""),
//            true
//        );
    },
    
    sendSMS: function (number, message) {
        // TODO: sms/telephony is not supported yet
        debug("mconnect.Device.sendSMS()");
        
//        this._call(
//            "org.mconnect.Device.Telephony.SendSMS",
//            new GLib.Variant("(ss)", [number, message]),
//            true
//        );
    },
    
    // Override Methods
    destroy: function () {
        for (let pluginName in this.plugins) {
            this.plugins[pluginName].destroy();
            delete this.plugins[pluginName];
        }
        delete this.props;
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
        this.listDevices().forEach((dbusPath) => {
            this._deviceAdded(this, dbusPath);
        });
    },
    
    // Callbacks
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
    
    // Methods
    allowDevice: function (dbusPath) {
        // Mark the device at *dbusPath* as allowed
        debug("mconnect.DeviceManager.allowDevice(" + dbusPath + ")");
        
        this._call("AllowDevice", new GLib.Variant('(s)', [dbusPath]), true);
    },
    
    disallowDevice: function (dbusPath) {
        // TODO: not a method yet
        // Unmark the device at *dbusPath* as unallowed
        debug("mconnect.DeviceManager.disallowDevice(" + dbusPath + ")");
        debug("mconnect.DeviceManager.disallowDevice(): Not Implemented")
    },
    
    listDevices: function () {
        debug("mconnect.DeviceManager.listDevices()");
        
        return this._call("ListDevices", new GLib.Variant("()", ""));
    },
    
    // Override Methods
    destroy: function () {
        for (let dbusPath in this.devices) {
            this._deviceRemoved(this, dbusPath);
        }
    }
});

