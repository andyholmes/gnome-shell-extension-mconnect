/*
  Inspired by, but not derived from, the venerable 'convenience.js' which is:
  Copyright (c) 2011-2012, Giovanni Campagna <scampa.giovanni@gmail.com>
*/

const Lang = imports.lang;
const Gettext = imports.gettext;
const _ = Gettext.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;


/** Return an extension object for GJS apps not privy to Gnome Shell imports */
function getCurrentExtension() {
    // Diced from: https://github.com/optimisme/gjs-examples/
    let m = new RegExp("@(.+):\\d+").exec((new Error()).stack.split("\n")[1]);
    let dir = Gio.File.new_for_path(m[1]).get_parent();
    
    let [s, meta, tag] = dir.get_child("metadata.json").load_contents(null);
    
    return {
        metadata: JSON.parse(meta),
        uuid: this.uuid,
        type: 2,
        dir: dir,
        path: dir.get_path(),
        error: "",
        hasPrefs: dir.get_child("prefs.js").query_exists(null)
    };
}

const Me = getCurrentExtension();

/** Init GSettings for Me.metadata['gschema-id'] */
let schemaSrc = Gio.SettingsSchemaSource.new_from_directory(
    Me.dir.get_child('schemas').get_path(),
    Gio.SettingsSchemaSource.get_default(),
    false
);

const Settings = new Gio.Settings({
    settings_schema: schemaSrc.lookup(Me.metadata['gschema-id'], true)
});
const Schema = Settings.settings_schema;

/** Initialize Gettext for metadata['gettext-domain'] */
function initTranslations() {
    Gettext.bindtextdomain(
        Me.metadata['gettext-domain'],
        Me.dir.get_child('locale').get_path()
    );
}
 
/** A Gtk.AboutDialog subclass for Extensions populated from metadata.json */
const AboutDialog = new Lang.Class({
    Name: "AboutDialog",
    Extends: Gtk.AboutDialog,
    
    _init: function (params) {
        //let logo = GdkPixbuf.Pixbuf.new_from_file_at_size("gtk.png", 64, 64)
        
        let defaults = {
            title: "TEST", // FIXME
            //logo: logo, // TODO
            logo_icon_name: "gnome-shell-extension-prefs",
            program_name: Me.metadata.name,
            version: Me.metadata.version.toString(),
            comments: Me.metadata.description,
            
            website: Me.metadata.url,
            //website_label: Me.metadata.name + _(" Website"),
            
            authors: [ "Andy Holmes <andrew.g.r.holmes@gmail.com>" ], // TODO
            //artists: Me.metadata.artists,
            translator_credits: _("translator-credits"),
            copyright: "Copyright 2017 Andy Holmes", // TODO
            
            license_type: Gtk.License.GPL_2_0, // e.g.o requires GPL-2
            wrap_license: true,
            
            modal: true,
            transient_for: null
        };
        
        this.parent(Object.assign(defaults, params));
    }
});

/**
 * Print a message to the log, prepended with the UUID of the extension
 * @param {String} msg - the message
 */
function log(msg) {
    global.log("[" + Me.metadata.uuid + "]: " + msg);
}

/**
 * Print a message to the log, prepended with the UUID of the extension and
 * "DEBUG".
 * @param {String} msg - the debugging message
 */
function debug(msg) {
    if (Settings.get_boolean("debug")) {
        log("DEBUG: " + msg);
    }
}

/**
 * Throws Error with @msg, if @condition doesn't resolve to 'true'.
 * @param {Boolean} condition - the condition to assert
 * @param {String} msg - the assertion message
 */
function assert(condition, msg) {
    if (Settings.get_boolean("debug") && !condition) {
        throw new Error("Assertion failed: " + msg || "unknown");
    }
}

