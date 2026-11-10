!include nsDialogs.nsh
!include MUI2.nsh
!include "TextFunc.nsh"
!include "WinMessages.nsh"

!insertmacro TrimNewLines

; Custom LangStrings for Step 1 Install Mode Choice
!pragma warning disable 6030
LangString onlyForMe 2052 "仅为当前用户安装（推荐）"
LangString forAll 2052 "为使用这台电脑的所有用户安装"
LangString onlyForMe 1033 "仅为当前用户安装（推荐）"
LangString forAll 1033 "为使用这台电脑的所有用户安装"

LangString freshInstallForCurrent 2052 "软件仅对当前登录的系统账户可见。"
LangString freshInstallForCurrent 1033 "软件仅对当前登录的系统账户可见。"
LangString freshInstallForAll 2052 "需要系统管理员（UAC）权限，安装后所有系统账户都能使用。"
LangString freshInstallForAll 1033 "需要系统管理员（UAC）权限，安装后所有系统账户都能使用。"

LangString perUserInstallExists 2052 "软件仅对当前登录的系统账户可见（已检测到现有安装）。"
LangString perUserInstallExists 1033 "软件仅对当前登录的系统账户可见（已检测到现有安装）。"
LangString perMachineInstallExists 2052 "需要系统管理员（UAC）权限，安装后所有系统账户都能使用（已检测到现有安装）。"
LangString perMachineInstallExists 1033 "需要系统管理员（UAC）权限，安装后所有系统账户都能使用（已检测到现有安装）。"

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
  ; Where the data is (from datapath.txt) and whether that is the folder MotoTrace itself creates
  ; ("default", dedicated to it) or one the user chose ("custom", which may hold other files too).
  Var UnDataDir
  Var UnDataKind
  Var UnDefaultDir
  ; $installMode (declared later than this file) as it was when the uninstaller started.
  Var UnInstallMode
!endif

; Define macros for page positioning in the wizard sequence
!macro customHeader
  ; No pages defined here, as customHeader is processed too early
!macroend

!macro customPageAfterChangeDir
  Page custom PagePaths PagePathsLeave
  Page custom PageShortcuts PageShortcutsLeave
!macroend

; Hook into the uninstaller welcome page slot to declare custom uninstaller pages before file deletion
!macro customUnWelcomePage
  UninstPage custom un.PageUnOptions un.PageUnOptionsLeave
  UninstPage custom un.PageUnConfirm un.PageUnConfirmLeave
!macroend



; ─────────────────────────────────────────────────────────────────────────────
; Installer Steps (Only compiled for Installer)
; ─────────────────────────────────────────────────────────────────────────────
!ifndef BUILD_UNINSTALLER

; Rules for the program folder and the data folder (checked in PagePathsLeave).
!include "${__FILEDIR__}\installPathRules.nsh"

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

  ; The program folder is emptied as a whole on upgrade and uninstall: it must be a folder of its own
  ; (MotoTrace is appended when needed) and the diary data must not live inside it.
  Call CheckInstallPaths
  ${If} $PathsError == "root"
    MessageBox MB_OK|MB_ICONEXCLAMATION "请选择一个文件夹来安装程序，不能直接使用磁盘根目录。"
    Abort
  ${ElseIf} $PathsError == "datainside"
    MessageBox MB_OK|MB_ICONEXCLAMATION "日记数据文件夹不能放在程序安装文件夹里面：升级或卸载时程序文件夹会被整个清空，数据会随之丢失。请把数据文件夹换到别处，或改选另一个程序安装位置。"
    Abort
  ${EndIf}
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

  ; 4. Data directory path synchronization. The app's settings always live in the current user's own
  ; %APPDATA%, also when installing for all users (where $APPDATA would be C:\ProgramData).
  ; Nothing is written during a silent install (the wizard pages did not run), and an existing
  ; datapath.txt - kept up to date by the app - is only replaced when the user picked a folder here.
  ${If} $installMode == "all"
    SetShellVarContext current
  ${EndIf}
  ${If} $StateDataDir != ""
    ${If} $StateDefaultData != ${BST_CHECKED}
    ${OrIfNot} ${FileExists} "$APPDATA\MotoTrace\datapath.txt"
      ; The app never creates a data folder the user chose by itself, so it has to exist.
      CreateDirectory "$StateDataDir"
      CreateDirectory "$APPDATA\MotoTrace"
      FileOpen $0 "$APPDATA\MotoTrace\datapath.txt" w
      FileWrite $0 "$StateDataDir"
      FileClose $0
    ${EndIf}
  ${EndIf}
  ${If} $installMode == "all"
    SetShellVarContext all
  ${EndIf}
!macroend

!endif

; ─────────────────────────────────────────────────────────────────────────────
; Uninstaller Steps (Only compiled for Uninstaller)
; ─────────────────────────────────────────────────────────────────────────────
!ifdef BUILD_UNINSTALLER

; How the data folder recorded in datapath.txt is read and classified (un.ClassifyDataDir).
!include "${__FILEDIR__}\dataPathRules.nsh"
!insertmacro DataPathRules "un."

; Asks before an interactive uninstall. An upgrade (and any /S run) runs the old uninstaller silently
; and must not ask: answering "no" there would abort the upgrade.
!macro customUnInit
  StrCpy $UnInstallMode $installMode
  ${IfNot} ${Silent}
    MessageBox MB_YESNO|MB_ICONQUESTION "确定要从您的电脑中移除 MotoTrace 吗？" /SD IDYES IDYES continue_un
    Abort
  ${EndIf}
continue_un:
!macroend

; Works out $UnDataDir and $UnDataKind from the per-user datapath.txt (the app keeps it current).
Function un.ResolveDataDir
  ; The app's settings always live in the current user's %APPDATA%, also for an all-users install.
  ${If} $UnInstallMode == "all"
    SetShellVarContext current
  ${EndIf}

  StrCpy $UnDataDir ""
  ClearErrors
  FileOpen $0 "$APPDATA\MotoTrace\datapath.txt" r
  ${IfNot} ${Errors}
    FileRead $0 $UnDataDir
    FileClose $0
  ${EndIf}

  ; Cleans the line up and decides "default" or "custom" (see dataPathRules.nsh).
  StrCpy $UnDefaultDir "$PROFILE\MotoTrace\data"
  Call un.ClassifyDataDir

  ${If} $UnInstallMode == "all"
    SetShellVarContext all
  ${EndIf}
FunctionEnd

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

  ; Name the folder that is affected. Only the folder MotoTrace creates for itself is ever emptied: a
  ; folder the user chose may hold other files, so it is left alone and the user is told so.
  Call un.ResolveDataDir
  ${If} $UnDataKind == "default"
    !insertmacro MUI_HEADER_TEXT "确认删除日记数据" "删除后数据将无法恢复"
  ${Else}
    !insertmacro MUI_HEADER_TEXT "您的数据在自选文件夹中" "卸载程序不会删除这个文件夹"
  ${EndIf}

  nsDialogs::Create 1018
  Pop $CustomDialog
  ${If} $CustomDialog == error
    Abort
  ${EndIf}

  ${If} $UnDataKind == "default"
    ; Create a large red bold warning label
    ${NSD_CreateLabel} 0 0 100% 100u "请注意：将永久删除下面这个文件夹及其中的全部内容，无法通过重装软件找回：$\r$\n$\r$\n$UnDataDir$\r$\n$\r$\n您确定要彻底删除所有日记数据吗？"
    Pop $0
    SetCtlColors $0 0xFF0000 "transparent"
    CreateFont $1 "Microsoft YaHei" 11 700
    SendMessage $0 ${WM_SETFONT} $1 1
  ${Else}
    ${NSD_CreateLabel} 0 0 100% 100u "您的日记数据保存在您自己选择的文件夹：$\r$\n$\r$\n$UnDataDir$\r$\n$\r$\n这个文件夹里可能还有您的其他文件，为避免误删，卸载程序不会删除它，数据和设置都会保留。如需清除，请在卸载完成后自行在资源管理器中删除。"
    Pop $0
  ${EndIf}

  ; Only a deletion needs the countdown; the notice about a kept folder can be confirmed at once.
  ${If} $UnDataKind == "default"
    ; Get uninstaller parent window buttons
    GetDlgItem $UninstNextButton $HWNDPARENT 1
    GetDlgItem $UninstBackButton $HWNDPARENT 3

    ; Disable the next button initially
    EnableWindow $UninstNextButton 0

    ; Start timer for 5 seconds countdown
    StrCpy $TimerCounter 5
    SendMessage $UninstNextButton ${WM_SETTEXT} 0 "STR:确定 (5秒)"
    ${NSD_CreateTimer} un.CountdownCallback 1000
  ${EndIf}

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
  ; Remove the shortcuts only when really uninstalling: an upgrade runs this old uninstaller too, and
  ; the new installer cannot know which of them (autostart in particular) the user had chosen.
  ${IfNot} ${isUpdated}
    Delete "$DESKTOP\MotoTrace.lnk"
    Delete "$SMPROGRAMS\MotoTrace.lnk"
    Delete "$SMSTARTUP\MotoTrace.lnk"
  ${EndIf}

  ; Clean data if they checked "Delete all user data" AND completed the confirmation page
  ${If} $StateUnData == ${BST_CHECKED}
    Call un.ResolveDataDir

    ; The app's settings live in the current user's %APPDATA%, also for an all-users install.
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}

    ${If} $UnDataKind == "default"
      ; The folder MotoTrace creates for itself: dedicated to it, so it goes with everything in it.
      RMDir /r "$UnDataDir"
      ; The folder around it, only if nothing else is in it (RMDir without /r never removes content).
      RMDir "$PROFILE\MotoTrace"
      ; Settings, including datapath.txt.
      RMDir /r "$APPDATA\MotoTrace"
    ${Else}
      ; A folder the user chose can hold anything: it is never emptied. The settings stay as well, so
      ; that installing again finds the data where it is.
      MessageBox MB_OK|MB_ICONINFORMATION "您的日记数据保存在您自己选择的文件夹中，为避免误删其中的其他文件，没有被删除：$\r$\n$\r$\n$UnDataDir$\r$\n$\r$\n如需清除，请自行在资源管理器中删除这个文件夹。" /SD IDOK
    ${EndIf}

    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}
!macroend

!endif
