!include nsDialogs.nsh
!include MUI2.nsh
!include "TextFunc.nsh"
!include "WinMessages.nsh"

!insertmacro TrimNewLines

; Custom LangStrings for Step 1 Install Mode Choice
!pragma warning disable 6030
LangString onlyForMe 2052 "仅为当前用户安装（推荐）"
LangString allUsers 2052 "为使用这台电脑的所有用户安装"
LangString onlyForMe 1033 "仅为当前用户安装（推荐）"
LangString allUsers 1033 "为使用这台电脑的所有用户安装"

; Shared Variables
Var CustomDialog

; Installer-only Variables
!ifndef BUILD_UNINSTALLER
  Var TextProgDir
  Var ButtonProgDir
  Var CheckboxDefaultData
  Var LabelDataDir
  Var TextDataDir
  Var ButtonDataDir
  Var CheckboxDesktop
  Var CheckboxStartMenu
  Var CheckboxAutostart

  Var StateDesktop
  Var StateStartMenu
  Var StateAutostart
  Var StateDefaultData
  Var StateDataDir
!endif

; Uninstaller-only Variables
!ifdef BUILD_UNINSTALLER
  Var CheckboxUnData
  Var UninstNextButton
  Var UninstBackButton
  Var TimerCounter

  Var StateUnData
!endif

!macro customHeader
  !ifdef BUILD_UNINSTALLER
    UninstPage custom un.PageUnOptions un.PageUnOptionsLeave
    UninstPage custom un.PageUnConfirm un.PageUnConfirmLeave
  !else
    Page custom PagePaths PagePathsLeave
    Page custom PageShortcuts PageShortcutsLeave
  !endif
!macroend

; ─────────────────────────────────────────────────────────────────────────────
; Installer Steps (Only compiled for Installer)
; ─────────────────────────────────────────────────────────────────────────────
!ifndef BUILD_UNINSTALLER

Function PagePaths
  !insertmacro MUI_HEADER_TEXT "选择安装与数据存储位置" "选择安装文件夹及数据存放文件夹"

  nsDialogs::Create 1018
  Pop $CustomDialog
  ${If} $CustomDialog == error
    Abort
  ${EndIf}

  ; 1. Program Path label
  ${NSD_CreateLabel} 0 0 100% 10u "程序安装位置:"
  Pop $0

  ; 2. Program Path textbox
  ${NSD_CreateText} 0 12u 80% 12u "$INSTDIR"
  Pop $TextProgDir

  ; 3. Program Path browse button
  ${NSD_CreateButton} 82% 12u 18% 12u "浏览..."
  Pop $ButtonProgDir
  ${NSD_OnClick} $ButtonProgDir OnBrowseProgDir

  ; 4. Data Path default checkbox
  ${NSD_CreateCheckbox} 0 32u 100% 10u "使用系统默认文档路径"
  Pop $CheckboxDefaultData
  ${NSD_SetState} $CheckboxDefaultData ${BST_CHECKED}
  ${NSD_OnClick} $CheckboxDefaultData OnCheckboxDefaultDataClick

  ; 5. Data Path label
  ${NSD_CreateLabel} 0 47u 100% 10u "日记数据存储位置:"
  Pop $LabelDataDir

  ; 6. Data Path textbox (disabled by default)
  ${NSD_CreateText} 0 59u 80% 12u "$PROFILE\MotoTrace\data"
  Pop $TextDataDir
  EnableWindow $TextDataDir 0

  ; 7. Data Path browse button (disabled by default)
  ${NSD_CreateButton} 82% 59u 18% 12u "浏览..."
  Pop $ButtonDataDir
  EnableWindow $ButtonDataDir 0
  ${NSD_OnClick} $ButtonDataDir OnBrowseDataDir

  nsDialogs::Show
FunctionEnd

Function OnBrowseProgDir
  Pop $0
  nsDialogs::SelectFolderDialog "选择程序安装文件夹" "$INSTDIR"
  Pop $1
  ${If} $1 != "error"
    ${NSD_SetText} $TextProgDir $1
  ${EndIf}
FunctionEnd

Function OnBrowseDataDir
  Pop $0
  nsDialogs::SelectFolderDialog "选择数据存储文件夹" "$PROFILE\MotoTrace\data"
  Pop $1
  ${If} $1 != "error"
    ${NSD_SetText} $TextDataDir $1
  ${EndIf}
FunctionEnd

Function OnCheckboxDefaultDataClick
  Pop $0
  ${NSD_GetState} $CheckboxDefaultData $1
  ${If} $1 == ${BST_CHECKED}
    EnableWindow $TextDataDir 0
    EnableWindow $ButtonDataDir 0
    ${NSD_SetText} $TextDataDir "$PROFILE\MotoTrace\data"
  ${Else}
    EnableWindow $TextDataDir 1
    EnableWindow $ButtonDataDir 1
  ${EndIf}
FunctionEnd

Function PagePathsLeave
  ${NSD_GetText} $TextProgDir $INSTDIR
  ${NSD_GetState} $CheckboxDefaultData $StateDefaultData
  ${NSD_GetText} $TextDataDir $StateDataDir
FunctionEnd

Function PageShortcuts
  !insertmacro MUI_HEADER_TEXT "选择附加任务" "选择您想要创建的快捷方式及自启动选项"

  nsDialogs::Create 1018
  Pop $CustomDialog
  ${If} $CustomDialog == error
    Abort
  ${EndIf}

  ; Checkbox for Desktop Shortcut
  ${NSD_CreateCheckbox} 0 10u 100% 12u "创建桌面快捷方式 (默认勾选)"
  Pop $CheckboxDesktop
  ${NSD_SetState} $CheckboxDesktop ${BST_CHECKED}

  ; Checkbox for Start Menu Shortcut
  ${NSD_CreateCheckbox} 0 25u 100% 12u "添加到开始菜单 (默认勾选)"
  Pop $CheckboxStartMenu
  ${NSD_SetState} $CheckboxStartMenu ${BST_CHECKED}

  ; Checkbox for Autostart
  ${NSD_CreateCheckbox} 0 40u 100% 12u "开机时自动启动 (默认不勾选)"
  Pop $CheckboxAutostart
  ${NSD_SetState} $CheckboxAutostart ${BST_UNCHECKED}

  nsDialogs::Show
FunctionEnd

Function PageShortcutsLeave
  ${NSD_GetState} $CheckboxDesktop $StateDesktop
  ${NSD_GetState} $CheckboxStartMenu $StateStartMenu
  ${NSD_GetState} $CheckboxAutostart $StateAutostart
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

!endif

; ─────────────────────────────────────────────────────────────────────────────
; Uninstaller Steps (Only compiled for Uninstaller)
; ─────────────────────────────────────────────────────────────────────────────
!ifdef BUILD_UNINSTALLER

!macro customUnInit
  MessageBox MB_YESNO|MB_ICONQUESTION "确定要从您的电脑中移除 MotoTrace 吗？" IDYES continue_un
  Abort
continue_un:
!macroend

Function un.PageUnOptions
  !insertmacro MUI_HEADER_TEXT "解除安装 MotoTrace" "选择卸载时的附加选项"

  nsDialogs::Create 1018
  Pop $CustomDialog
  ${If} $CustomDialog == error
    Abort
  ${EndIf}

  ; Create Checkbox for deleting user data (red text, bold font)
  ${NSD_CreateCheckbox} 0 10u 100% 30u "删除所有用户数据（包括所有日记文本、媒体附件及本地备份）"
  Pop $CheckboxUnData
  ${NSD_SetState} $CheckboxUnData ${BST_UNCHECKED}

  ; Make text red and bold
  SetCtlColors $CheckboxUnData 0xFF0000 "transparent"
  CreateFont $1 "Microsoft YaHei" 9 700
  SendMessage $CheckboxUnData ${WM_SETFONT} $1 1

  nsDialogs::Show
FunctionEnd

Function un.PageUnOptionsLeave
  ${NSD_GetState} $CheckboxUnData $StateUnData
FunctionEnd

Function un.PageUnConfirm
  ; Skip this page if user did not check the "delete data" option in Step 2
  ${If} $StateUnData != ${BST_CHECKED}
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "确认删除日记数据" "删除后数据将无法恢复"

  nsDialogs::Create 1018
  Pop $CustomDialog
  ${If} $CustomDialog == error
    Abort
  ${EndIf}

  ; Create a large red bold warning label
  ${NSD_CreateLabel} 0 0 100% 60u "请注意：删除后您的日记资产将永久丢失，无法通过重装软件找回。您确定要彻底删除所有日记数据吗？"
  Pop $0
  SetCtlColors $0 0xFF0000 "transparent"
  CreateFont $1 "Microsoft YaHei" 11 700
  SendMessage $0 ${WM_SETFONT} $1 1

  ; Get uninstaller parent window buttons
  GetDlgItem $UninstNextButton $HWNDPARENT 1
  GetDlgItem $UninstBackButton $HWNDPARENT 3

  ; Disable the next button initially
  EnableWindow $UninstNextButton 0
  
  ; Start timer for 5 seconds countdown
  StrCpy $TimerCounter 5
  SendMessage $UninstNextButton ${WM_SETTEXT} 0 "STR:确定 (5秒)"
  ${NSD_CreateTimer} un.CountdownCallback 1000

  nsDialogs::Show
FunctionEnd

Function un.PageUnConfirmLeave
  ${NSD_KillTimer} un.CountdownCallback
FunctionEnd

Function un.CountdownCallback
  IntOp $TimerCounter $TimerCounter - 1
  ${If} $TimerCounter <= 0
    ${NSD_KillTimer} un.CountdownCallback
    EnableWindow $UninstNextButton 1
    SendMessage $UninstNextButton ${WM_SETTEXT} 0 "STR:确定"
  ${Else}
    SendMessage $UninstNextButton ${WM_SETTEXT} 0 "STR:确定 ($TimerCounter秒)"
  ${EndIf}
FunctionEnd

!macro customUnInstall
  ; Remove shortcuts
  Delete "$DESKTOP\MotoTrace.lnk"
  Delete "$SMPROGRAMS\MotoTrace.lnk"
  Delete "$SMSTARTUP\MotoTrace.lnk"

  ; Clean data if they checked "Delete all user data" AND completed the countdown confirmation page
  ${If} $StateUnData == ${BST_CHECKED}
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
  ${EndIf}
!macroend

!endif
