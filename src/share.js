/** share.js - A simple FileChooserDialog for sending files */

const Lang = imports.lang;
const System = imports.system;
const Gettext = imports.gettext.domain('gnome-shell-extension-mconnect');
const _ = Gettext.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
function getPath() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    return Gio.File.new_for_path(m[1]).get_parent().get_path();
}

imports.searchPath.push(getPath());

const MConnect = imports.mconnect;
const KDEConnect = imports.kdeconnect;
const { Settings } = imports.lib;
const Me = imports.lib.getCurrentExtension();

const ServiceBackend = {
    MCONNECT: 0,
    KDECONNECT: 1
};


const Application = new Lang.Class({
    Name: "Application",
    Extends: Gio.Application,

    _init: function(params={}) {
        this.parent(params);
        
        let application_name = _("MConnect");

        GLib.set_prgname(application_name);
        GLib.set_application_name(application_name);
        
        //
        this._cmd = null;
        this._path = null;
        this._id = null;
        
        // Options
        this.add_main_option(
            "device",
            "d".charCodeAt(0),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.STRING,
            "Device ID",
            "<device-id>"
        );
        
        this.add_main_option(
            "share",
            "s".charCodeAt(0),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.FILENAME,
            "Share a file to <device-id>",
            "<path>"
        );
        
        this.add_main_option(
            "list-devices",
            "l".charCodeAt(0),
            GLib.OptionFlags.NONE,
            GLib.OptionArg.NONE,
            "List all devices that are reachable and trusted",
            null
        );
    },

    vfunc_startup: function() {
        this.parent();
        
        if (Settings.get_enum("service-backend") === ServiceBackend.MCONNECT) {
            this.manager = new MConnect.DeviceManager();
        } else {
            this.manager = new KDEConnect.DeviceManager();
        }
    },

    vfunc_activate: function() {
        let devices = [];
        
        for (let dbusPath in this.manager.devices) {
            devices.push(this.manager.devices[dbusPath]);
        }
        
        if (this._cmd === "list-devices") {
            for (let device of devices) {
                if (device.trusted) {
                    print(device.name + ": " + device.id);
                }
            }
        } else if (this._cmd === "share") {
            for (let device of devices) {
                if (device.id === this._id && device.hasOwnProperty("share")) {
                    device.shareURI(this._path.toString());
                } else {
                    throw Error("no device or share not supported");
                }
            }
        } else if (this._id) {
            Gtk.init(null);
            
            let dialog = new Gtk.FileChooserDialog({
                title: _("Send file..."),
                action: Gtk.FileChooserAction.OPEN,
                icon_name: "send-to",
                modal: true
            });
        
            dialog.add_button(_("Cancel"), Gtk.ResponseType.CANCEL);
            dialog.add_button(_("Send"), Gtk.ResponseType.OK);
            dialog.set_default_response(Gtk.ResponseType.OK);
            dialog.connect("delete-event", this.vfunc_shutdown);
            
            if (dialog.run() === Gtk.ResponseType.OK) {
                this._path = dialog.get_filename();
            }
            
            dialog.destroy();
            
            if (!this._path) { return; }
            
            for (let device of devices) {
                if (device.id === this._id && device.hasOwnProperty("share")) {
                    device.shareURI(this._path.toString());
                } else {
                    throw Error("no device or share not supported");
                }
            } 
        } else {
            throw Error("no command given");
        }
    },

    vfunc_shutdown: function() {
        this.parent();
        
        this.manager.destroy();
        delete this.manager;
    },
    
    vfunc_handle_local_options: function(options) {
        if (options.contains("device")) {
            this._id = options.lookup_value("device", null).deep_unpack();
        }
        
        if (options.contains("list-devices")) {
            this._cmd = "list-devices";
        } else if (options.contains("share")) {
            this._cmd = "share";
            this._path = options.lookup_value("share", null).deep_unpack();
        }
        
        return -1;
    }
});

let prog = new Application({
    application_id: 'org.gnome.shell.extensions.mconnect',
    flags: Gio.ApplicationFlags.FLAGS_NONE
});

prog.run([System.programInvocationName].concat(ARGV));

