"""
nautilus-send-mconnect.py - A Nautilus extension for sending files via
                            MConnect/KDE Connect.

A great deal of credit and appreciation is owed to the indicator-kdeconnect
developers for the sister Python script 'kdeconnect-send-nautilus.py':

https://github.com/Bajoja/indicator-kdeconnect/blob/master/data/extensions/kdeconnect-send-nautilus.py
"""

import gi
gi.require_version('Nautilus', '3.0')
gi.require_version('Notify', '0.7')
from gi.repository import Nautilus, GObject, Notify

import gettext
import locale
import os.path
import subprocess
import urllib

_ = gettext.gettext

LOCALE_DIR = os.path.expanduser("~/.local/share/gnome-shell/extensions/mconnect@andyholmes.github.io/locale")
CLI_PATH = os.path.expanduser("~/.local/share/gnome-shell/extensions/mconnect@andyholmes.github.io/share.js")


class MConnectShareExtension(GObject.GObject, Nautilus.MenuProvider):
    """A context menu for sending files via the MConnect/KDE Connect."""

    def __init__(self):
        pass

    def init_gettext(self):
        """Initialize translations"""
        
        try:
            locale.setlocale(locale.LC_ALL, '')
            gettext.bindtextdomain(
                'gnome-shell-extension-mconnect',
                LOCALE_DIR
            )
            gettext.textdomain('gnome-shell-extension-mconnect')
        except:
            pass

    def get_reachable_devices(self):
        """Return a list of reachable, trusted devices"""
        
        cli_prog = ['gjs', CLI_PATH, '-l']
        out = subprocess.Popen(cli_prog, stdout=subprocess.PIPE).stdout.read()
        
        devices = []
        
        for device in filter(None, out.decode('utf-8').split("\n")):
            device_name, device_id = device.split(': ')
            devices.append({ 'name': device_name, 'id': device_id })

        return devices

    def send_files(self, menu, files, device):
        """Send *files* to *device_id*"""
        
        for file in files:
            subprocess.Popen([
                'gjs',
                CLI_PATH,
                '--device',
                device['id'],
                '--share',
                urllib.url2pathname(file.get_uri()[7:])
            ])

        self.init_gettext()
        
        Notify.init('gnome-shell-extension-mconnect')
        Notify.Notification.new(
            device['name'],
            gettext.ngettext('Sending {num} file', 'Sending {num} files', len(files)).format(num=len(files)),
            'send-to-symbolic'
        ).show()

    def get_background_items(provider, window, current_folder):
        pass

    def get_file_items(self, window, files):
        """Return a list of select files to be sent"""
        
        # Try to get devices
        try:
            devices = self.get_reachable_devices()
        except Exception as e:
            raise Exception('Error while getting reachable devices')

        # No devices, don't show menu entry
        if not devices:
            return

        # Only accept regular files
        for uri in files:
            if uri.get_uri_scheme() != 'file' or uri.is_directory():
                return

        self.init_gettext()
        
        # Context Menu Item
        menu = Nautilus.MenuItem(
            name='MConnectShareExtension::Devices',
            label=_('Send To Mobile Device'),
            icon='smartphone-symbolic'
        )

        # Context Menu
        submenu = Nautilus.Menu()
        menu.set_submenu(submenu)

        # Context Submenu Items
        for device in devices:
            item = Nautilus.MenuItem(
                name='MConnectShareExtension::Device' + device['id'],
                label=device['name'],
                icon='smartphone-symbolic'
            )
            
            item.connect('activate', self.send_files, files, device)
            
            submenu.append_item(item)

        return menu,
        
