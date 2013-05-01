include $(TOPDIR)/rules.mk

PKG_NAME:=plugin_gargoyle_wifi_survey
PKG_VERSION:=1.2.1
PKG_RELEASE:=1


PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/plugin-gargoyle-wifi-survey
	SECTION:=admin
	CATEGORY:=Administration
	SUBMENU:=Gargoyle Web Interface
	TITLE:=WiFi site survey for Gargoyle-router
	MAINTAINER:=BashfulBladder
	DEPENDS:=+gargoyle +wireless-tools
	PKGARCH:=all
endef

define Package/plugin-gargoyle-wifi-survey/description
	WiFi site survey for Gargoyle
endef

define Build/Prepare
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/plugin-gargoyle-wifi-survey/postinst
#!/bin/sh

if [ -z "$${IPKG_INSTROOT}" ]; then
	uci set gargoyle.display.system_wifi_survey='WiFi Survey'
	uci set gargoyle.scripts.system_wifi_survey='wifi_survey.sh'
	uci set gargoyle.system.wifi_survey='380'
	uci commit
fi
endef

define Package/plugin-gargoyle-wifi-survey/postrm
#!/bin/sh

if [ -z "$${IPKG_INSTROOT}" ]; then
	uci del gargoyle.display.system_wifi_survey
	uci del gargoyle.scripts.system_wifi_survey
	uci del gargoyle.system.wifi_survey
	uci commit
fi
grep -v -e "plugin-gargoyle-wifi-survey/OUIs.js" /etc/rc.local > /tmp/rc.local
mv /tmp/rc.local /etc/rc.local

#its jacked up, but delete OUIs.js from each mounted partition
mnt=1
while true; do
  if [ -e /tmp/mounted_usb_storage.tab ] ; then
    apart=$$(awk -v mnt=$$mnt 'NR==mnt {print $$3}' /tmp/mounted_usb_storage.tab)
    if [ -z $$apart ] ; then
      break
    fi
    if [ -e $$apart/OUIs.js ] ; then
      rm -f $$apart/OUIs.js
    fi
    let mnt++
  fi
done
if [ -e /tmp/OUIs.js ] ; then
  rm -f /tmp/OUIs.js
fi
endef

define Package/plugin-gargoyle-wifi-survey/install
	$(INSTALL_DIR) $(1)
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,plugin-gargoyle-wifi-survey))