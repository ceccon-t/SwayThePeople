#!/bin/bash
# Replaces electron-builder's default postinst (deb.afterInstall swaps the whole
# script, so the symlink/mime/desktop steps below mirror the default template).
# One deliberate change: always make chrome-sandbox SUID. The default only does
# so when `unshare --user` fails, but postinst runs as root where userns always
# works — on kernels that restrict unprivileged userns (Ubuntu 23.10+) that
# leaves the app without any usable sandbox. With the SUID helper in place the
# runtime launcher (scripts/after-pack.cjs) keeps the app sandboxed everywhere.
# Paths are literal because fpm does not template custom scripts.

if type update-alternatives 2>/dev/null >&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/swaythepeople' -a -e '/usr/bin/swaythepeople' -a "`readlink '/usr/bin/swaythepeople'`" != '/etc/alternatives/swaythepeople' ]; then
        rm -f '/usr/bin/swaythepeople'
    fi
    update-alternatives --install '/usr/bin/swaythepeople' 'swaythepeople' '/opt/SwayThePeople/swaythepeople' 100 || ln -sf '/opt/SwayThePeople/swaythepeople' '/usr/bin/swaythepeople'
else
    ln -sf '/opt/SwayThePeople/swaythepeople' '/usr/bin/swaythepeople'
fi

chmod 4755 '/opt/SwayThePeople/chrome-sandbox' || true

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi
