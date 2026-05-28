!include nsDialogs.nsh
!include MUI2.nsh
!include "TextFunc.nsh"

!insertmacro TrimNewLines

Var CustomDialog
Var CheckboxDesktop
Var CheckboxStartMenu
Var CheckboxAutostart
Var LabelDataDir
Var TextDataDir
Var ButtonDataDir

Var StateDesktop
Var StateStartMenu
Var StateAutostart
Var StateDataDir

!macro customHeader
  Page custom CustomOptionsPage CustomOptionsPageLeave
!macroend

Function CustomOptionsPage
  !insertmacro MUI_HEADER_TEXT "安装选项" "选择您想要的快捷方式、自启动及数据存储选项"

  nsDialogs::Create 1018
  Pop $CustomDialog
  ${If} $CustomDialog == error
    Abort
  ${EndIf}

  ; Checkbox for Desktop Shortcut
  ${NSD_CreateCheckbox} 0 0u 100% 10u "创建桌面快捷方式"
  Pop $CheckboxDesktop
  ${NSD_SetState} $CheckboxDesktop ${BST_CHECKED}

  ; Checkbox for Start Menu Shortcut
  ${NSD_CreateCheckbox} 0 15u 100% 10u "添加到开始菜单"
  Pop $CheckboxStartMenu
  ${NSD_SetState} $CheckboxStartMenu ${BST_CHECKED}

  ; Checkbox for Autostart
  ${NSD_CreateCheckbox} 0 30u 100% 10u "开机时自动启动"
  Pop $CheckboxAutostart
  ${NSD_SetState} $CheckboxAutostart ${BST_UNCHECKED}

  ; Label for Data Storage
  ${NSD_CreateLabel} 0 48u 100% 10u "数据存储位置 (默认及自定义):"
  Pop $LabelDataDir

  ; Textbox for Data Storage Path
  ${NSD_CreateText} 0 60u 80% 12u "$PROFILE\MotoTrace\data"
  Pop $TextDataDir

  ; Browse button for Data Storage Path
  ${NSD_CreateButton} 82% 60u 18% 12u "浏览..."
  Pop $ButtonDataDir
  ${NSD_OnClick} $ButtonDataDir OnBrowseDataDir

  nsDialogs::Show
FunctionEnd

Function OnBrowseDataDir
  ; Pop the button control index
  Pop $0
  ; Show directory selection dialog
  nsDialogs::SelectFolderDialog "选择数据存储文件夹" "$PROFILE\MotoTrace\data"
  Pop $1
  ${If} $1 != "error"
    ${NSD_SetText} $TextDataDir $1
  ${EndIf}
FunctionEnd

Function CustomOptionsPageLeave
  ${NSD_GetState} $CheckboxDesktop $StateDesktop
  ${NSD_GetState} $CheckboxStartMenu $StateStartMenu
  ${NSD_GetState} $CheckboxAutostart $StateAutostart
  ${NSD_GetText} $TextDataDir $StateDataDir
FunctionEnd

!macro customInstall
  ; 1. Desktop shortcut
  ${If} $StateDesktop == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\MotoTrace.lnk" "$INSTDIR\MotoTrace.exe"
  ${EndIf}

  ; 2. Start Menu shortcut
  ${If} $StateStartMenu == ${BST_CHECKED}
    CreateShortCut "$SMPROGRAMS\MotoTrace.lnk" "$INSTDIR\MotoTrace.exe"
  ${EndIf}

  ; 3. Autostart on boot shortcut
  ${If} $StateAutostart == ${BST_CHECKED}
    CreateShortCut "$SMSTARTUP\MotoTrace.lnk" "$INSTDIR\MotoTrace.exe"
  ${EndIf}

  ; 4. Data directory path synchronization
  CreateDirectory "$APPDATA\MotoTrace"
  FileOpen $0 "$APPDATA\MotoTrace\datapath.txt" w
  FileWrite $0 "$StateDataDir"
  FileClose $0
!macroend

!macro customUnInstall
  ; Remove shortcuts
  Delete "$DESKTOP\MotoTrace.lnk"
  Delete "$SMPROGRAMS\MotoTrace.lnk"
  Delete "$SMSTARTUP\MotoTrace.lnk"

  ; Ask user if they want to delete all user data
  MessageBox MB_YESNO|MB_ICONQUESTION "您是否要在卸载时删除所有个人数据及配置？" IDNO skip_delete

  ; First confirmation
  MessageBox MB_YESNO|MB_ICONQUESTION "第一重确认：您确定要删除所有追踪数据吗？此操作不可逆！" IDNO skip_delete

  ; Second confirmation
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "第二重确认（警告）：这将永久删除您的所有日记和追踪记录。再次确认是否删除？" IDNO skip_delete

  ; Read custom data path
  ClearErrors
  FileOpen $0 "$APPDATA\MotoTrace\datapath.txt" r
  IfErrors read_default
  FileRead $0 $1
  FileClose $0
  
  ; Trim newlines
  ${TrimNewLines} "$1" $R0
  StrCmp $R0 "" read_default
  Goto delete_data

read_default:
  StrCpy $R0 "$PROFILE\MotoTrace\data"

delete_data:
  ; Safety check: Make sure we don't delete a drive root!
  ; Check if path length is <= 3 (e.g. "C:\" or "D:\")
  StrLen $2 $R0
  IntCmp $2 3 skip_delete skip_delete

  ; Delete custom data folder recursively
  RMDir /r $R0

  ; Delete AppData configuration folder recursively
  RMDir /r "$APPDATA\MotoTrace"

skip_delete:
!macroend
