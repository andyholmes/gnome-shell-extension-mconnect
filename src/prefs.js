"use strict";

const Lang = imports.lang;
const Gettext = imports.gettext.domain('gnome-shell-extension-mconnect');
const _ = Gettext.gettext;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

// Local Imports
const Me = imports.misc.extensionUtils.getCurrentExtension();
const { initTranslations, AboutDialog, SettingsWidget, Settings } = Me.imports.convenience;


function init() {
    initTranslations();
}

// Extension Preferences
function buildPrefsWidget() {
    let widget = new SettingsWidget();
    
    let ifaceSection = widget.add_section(_("Interface"));
    ["device-indicators",
    "device-visibility"].forEach((option) => {
        widget.add_setting(ifaceSection, option);
    });
    
    let desktopSection = widget.add_section(_("Service"));
    ["service-autostart",
    "service-backend"].forEach((option) => {
        widget.add_setting(desktopSection, option);
    });
    
    let develSection = widget.add_section(_("Development"));
    widget.add_setting(develSection, "debug");
    
    // TODO: everything below is only testing TODO //
    let testSection = widget.add_section(_("Test Section"));
    ["int-key",
    "range-key",
    "choices-key",
    "str-key",
    "other-key",
    "mb-key"].forEach((option) => {
        widget.add_setting(testSection, option);
    });
    
    let butt = new Gtk.Button({ label: "About" });
    butt.connect("clicked", () => {
        let di = new AboutDialog();
        di.run();
        di.destroy();
    });
    
    widget.box.add(butt);
    
    widget.show_all();
    return widget;
}

