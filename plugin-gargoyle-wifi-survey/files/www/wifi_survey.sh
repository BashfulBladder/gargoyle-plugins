#!/usr/bin/haserl
<?
	# This webpage is copyright ¬© 2013 by BashfulBladder 
	# There is not much to this page, so this is public domain 
	eval $( gargoyle_session_validator -c "$COOKIE_hash" -e "$COOKIE_exp" -a "$HTTP_USER_AGENT" -i "$REMOTE_ADDR" -r "login.sh" -t $(uci get gargoyle.global.session_timeout) -b "$COOKIE_browser_time"  )
	gargoyle_header_footer -h -s "system" -p "wifi_survey" -c "internal.css" -j "table.js  wifi_survey.js" gargoyle

?>

<script>
<!--
<?
	smb_share=`uci -q show samba | grep -m 1 '/tmp/usb_mount' | awk -F '=' '{print $2}'`
	nfs_share=`uci -q show nfsd | grep -m 1 '/tmp/usb_mount' | awk -F '=' '{print $2}'`
	ftp_share=`uci -q show vsftpd | grep -m 1 '/tmp/usb_mount' | awk -F '=' '{print $2}'`
	oui_src=""
	sharepoint=""
	share_freespace=""
	
	if [ -e /tmp/survey_data.txt ] ; then
		cat /tmp/survey_data.txt
	else
		echo "var sdata = [];"
	fi
	if [ ! -z "$smb_share" ] ; then
		sharepoint="$smb_share"
		share_freespace=`df "$smb_share" | awk '/\/dev\// {print $4}'`
	elif [ ! -z "$nfs_share" ] ; then
		sharepoint="$nfs_share"
		share_freespace=`df "$nfs_share" | awk '/\/dev\// {print $4}'`
	elif [ ! -z "$ftp_share" ] ; then
		sharepoint="$ftp_share"
		share_freespace=`df "$ftp_share" | awk '/\/dev\// {print $4}'`
	fi
	echo "var sharepoint=\"$sharepoint\";"
	echo "var share_freespace=\"$share_freespace\";"
	
	echo "var tmp_freespace=\"`df | awk '/tmpfs/ $4 > max { max=$4 }; END { print max }'`\";"
	echo "var wifs=\"`awk '{gsub(/:/,\"\"); printf (NR>2 ? $1\" \" : null)} END {printf \"\n\"}' /proc/net/wireless`\";"
	echo "var curr_time=\"`date \"+%Y%m%d%H%M\"`\";"
	
	echo "var wgetOUI=\"`awk '/OUIs.js/ {print $4}' /etc/rc.local`\";"
	
	OUI_cat=""
	if [ -e "$smb_share"/OUIs.js ] ; then
		OUI_cat="cat $smb_share/OUIs.js"
		oui_src="USB"
	elif [ -e "$nfs_share"/OUIs.js ] ; then
		OUI_cat="cat $nfs_share/OUIs.js"
		oui_src="USB"
	elif [ -e "$ftp_share"/OUIs.js ] ; then
		OUI_cat="cat $ftp_share/OUIs.js"
		oui_src="USB"
	elif [ -e /tmp/OUIs.js ] ; then
		OUI_cat="cat /tmp/OUIs.js"
		oui_src="RAM"
	fi
	echo "var oui_src=\"$oui_src\";"
	$OUI_cat
?>

var station_data = new Array();
for (sd in sdata) {
	station_data.push(sdata[sd]);
}

//-->
</script>

<style type="text/css">

.backer{ display:block; width:90px; height:8px; background:#ddd; border-radius:4px; margin: 0 0 8px 0;}
.dbacker{ display:block; width:90px; height:8px; background:#aaa; border-radius:4px; margin: 0 0 8px 0;}

.bfiller{ display:block; height:8px; background:#0066ff; border-radius:4px; }
.gfiller{ display:block; height:8px; background:#00ff00; border-radius:4px; }
.yfiller{ display:block; height:8px; background:#ffff00; border-radius:4px; }
.ofiller{ display:block; height:8px; background:#ff9900; border-radius:4px; }
.rfiller{ display:block; height:8px; background:#ff0000; border-radius:4px; }
	
</style>

<fieldset id="wifi_survey">
	<legend class="sectionheader">WiFi Survey</legend>
			
	<div id='caveat'>
		<label class='nocolumn' id='advisory'>Survey refreshes every 2 minutes</label>
		<span id='tracking' style="float: right; cursor: pointer" onmouseover="ShowCurrentInfo(this)"></span>
	</div>	
	<div>
		<div id="station_table_container"</div>
	</div>

	<div id="notes">
		<span id='note_txt'></span>
	</div>
</fieldset>

<fieldset id="OUI">
	<legend class="sectionheader">Vendor Lookup</legend>
	
	<div id='oui_container'>
		<div id="oui">
			<span class='nocolumn' id="oui_txt"></span>
		</div>
		<div class="internal_divider"></div>
		
		<span class='leftcolumn'><input id="OUIs_button" type='button' class="default_button" value="Download vendors file" name="tmpfs" onclick="DoVendorFile(this.name)"/></span>
		<span class='rightcolumn' id='oui_info'>Download vendors/OUIs to RAM (lost after reboot)</span>
		<br />
		<em>
			<span class='rightcolumnonly' id='button_info'>Hold down alt/option key to survive restarts.</span>
		</em>
	</div>
</fieldset>

<fieldset id="chutil" style="display:none;">
	<legend class="sectionheader">Channel Utilization</legend>
	
	<object id="band24" data="channels.svg" type="image/svg+xml" style="margin: 5px; float:left; width:700px; height:700px; background: #272727"></object>
	
</fieldset>

<script>
<!--
	InitSurvey();
//-->
</script>

<?
	gargoyle_header_footer -f -s "system" -p "wifi_survey"
?>
