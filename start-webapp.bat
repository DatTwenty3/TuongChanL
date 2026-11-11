@echo off
chcp 65001 >nul
setlocal EnableExtensions

title TuongChanL Web App - Launcher
pushd "%~dp0" >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong the truy cap thu muc chua script: "%~dp0"
    pause
    exit /b 1
)

set "MODE=preview"
set "PORT=4173"
set "PORT_SET=0"
set "FORCE_INSTALL=0"
set "FORCE_BUILD=0"
set "LAN_HOST=0"
set "NO_OPEN=0"
set "CHECK_ONLY=0"

:parse_args
if "%~1"=="" goto :args_done
if /i "%~1"=="--dev" (
    set "MODE=dev"
    shift
    goto :parse_args
)
if /i "%~1"=="--rebuild" (
    set "FORCE_BUILD=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--build" (
    set "FORCE_BUILD=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--install" (
    set "FORCE_INSTALL=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--reinstall" (
    set "FORCE_INSTALL=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--lan" (
    set "LAN_HOST=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--no-open" (
    set "NO_OPEN=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--check" (
    set "CHECK_ONLY=1"
    shift
    goto :parse_args
)
if /i "%~1"=="--port" (
    if "%~2"=="" (
        echo [LOI] Thieu gia tri cong sau --port
        goto :fail
    )
    set "PORT=%~2"
    set "PORT_SET=1"
    shift
    shift
    goto :parse_args
)
if /i "%~1"=="--help" goto :show_help
if /i "%~1"=="-h" goto :show_help
if "%~1"=="/?" goto :show_help
echo [CANH BAO] Bo qua tham so khong hop le: %~1
shift
goto :parse_args

:args_done
if /i "%MODE%"=="dev" if "%PORT_SET%"=="0" set "PORT=5173"

echo ============================================================================
echo   TUONG CHAN CHU L - KHOI DONG WEB APP (TCVN 11823:2017 / 2D CAD / 3D)
echo   Thu muc: %CD%
echo ============================================================================
echo.

if not exist "package.json" (
    echo [LOI] Khong tim thay package.json trong thu muc "%CD%".
    echo       Hay dat file start-webapp.bat ben trong thu muc TuongChanL-Web\.
    goto :fail
)

rem ---------------------------------------------------------------------------
rem [1/4] Kiem tra & tu dong cai dat Node.js / npm (neu may moi chua co)
rem ---------------------------------------------------------------------------
echo [1/4] Kiem tra Node.js va npm...
call :add_common_node_paths
call :check_node_ready
if errorlevel 1 (
    echo [INFO] Chua co Node.js phu hop ^(yeu cau v18, v20 hoac v22+^). Dang tu dong cai dat...
    call :install_node_lts
    call :refresh_path
    call :add_common_node_paths
    call :check_node_ready
    if errorlevel 1 (
        echo.
        echo [LOI] Khong the tu dong cai dat Node.js LTS.
        echo       Vui long cai dat thu cong Node.js LTS tai: https://nodejs.org/
        echo       Sau do chay lai start-webapp.bat.
        goto :fail
    )
)

for /f "delims=" %%V in ('node -v 2^>nul') do set "NODE_VER=%%V"
for /f "delims=" %%N in ('call npm -v 2^>nul') do set "NPM_VER=%%N"
if "%NPM_VER%"=="" (
    echo [LOI] Tim thay Node.js ^(%NODE_VER%^) nhung khong goi duoc npm.
    goto :fail
)
echo [OK]   Node.js %NODE_VER% ^| npm v%NPM_VER%

rem ---------------------------------------------------------------------------
rem [2/4] Kiem tra / tu dong cai dat thu vien (node_modules)
rem ---------------------------------------------------------------------------
echo.
echo [2/4] Kiem tra thu vien Node.js (node_modules)...
set "NEED_DEPS=0"
if "%FORCE_INSTALL%"=="1" set "NEED_DEPS=1"
if not exist "node_modules\.bin\vite.cmd" set "NEED_DEPS=1"

if "%NEED_DEPS%"=="0" (
    node -e "Promise.all([import('vite'),import('esbuild'),import('rollup'),import('react'),import('react-dom'),import('pdf-lib')]).catch(()=>process.exit(1))" >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Thu vien hien tai bi thieu hoac khac he dieu hanh ^(Windows native binaries^). Se tu dong cai lai...
        set "NEED_DEPS=1"
    )
)

if "%NEED_DEPS%"=="1" (
    echo [INFO] Dang cai dat cac goi thu vien qua npm ^(lan dau co the mat 1-3 phut^)...
    if "%FORCE_INSTALL%"=="0" if exist "package-lock.json" if not exist "node_modules" (
        call npm ci --no-audit --no-fund
        if errorlevel 1 (
            echo [WARN] npm ci that bai, thu chuyen sang npm install...
            call npm install --no-audit --no-fund
        )
    ) else (
        call npm install --no-audit --no-fund
    )
    if errorlevel 1 (
        echo [LOI] Cai dat thu vien npm that bai. Kiem tra ket noi mang hoac quyen ghi thu muc.
        goto :fail
    )
    node -e "Promise.all([import('vite'),import('esbuild'),import('rollup'),import('react'),import('react-dom'),import('pdf-lib')]).catch(()=>process.exit(1))" >nul 2>&1
    if errorlevel 1 (
        echo [LOI] Thu vien da cai nhung van thieu module can thiet cho Vite/WebApp.
        goto :fail
    )
)
echo [OK]   Tat ca thu vien da san sang.

rem ---------------------------------------------------------------------------
rem [3/4] Kiem tra / build ban production (dist/) khi can thiet
rem ---------------------------------------------------------------------------
echo.
if /i "%MODE%"=="dev" (
    echo [3/4] Bo qua build dist/ do dang chon che do phat trien ^(--dev^).
) else (
    echo [3/4] Kiem tra ban build Web App ^(dist/^)...
    set "NEED_BUILD=%FORCE_BUILD%"
    if not exist "dist\index.html" set "NEED_BUILD=1"
    if "%FORCE_BUILD%"=="0" if exist "dist\index.html" (
        powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=Get-Item 'dist\index.html' -ErrorAction SilentlyContinue; if(-not $d){exit 2}; $src=@(Get-Item 'index.html','package.json','vite.config.ts','tsconfig.json' -ErrorAction SilentlyContinue)+@(Get-ChildItem 'src' -Recurse -File -ErrorAction SilentlyContinue); foreach($f in $src){ if($f.LastWriteTimeUtc -gt $d.LastWriteTimeUtc){ exit 2 } }; exit 0" >nul 2>&1
        if errorlevel 1 set "NEED_BUILD=1"
    )
    call :run_build_if_needed
    if errorlevel 1 goto :fail
)

if "%CHECK_ONLY%"=="1" (
    echo.
    echo [OK] Hoan tat kiem tra moi truong, thu vien va ban build ^(--check^).
    goto :success
)

rem ---------------------------------------------------------------------------
rem [4/4] Khoi dong may chu web & tu dong mo trinh duyet
rem ---------------------------------------------------------------------------
echo.
echo [4/4] Dang khoi dong may chu Web App...
set "HOST_ARG=--host 127.0.0.1"
set "URL_HOST=127.0.0.1"
if "%LAN_HOST%"=="1" (
    set "HOST_ARG=--host"
    set "URL_HOST=localhost"
)
set "OPEN_ARG=--open"
if "%NO_OPEN%"=="1" set "OPEN_ARG="

echo       Che do : %MODE%
echo       Cong   : %PORT% ^(neu ban, Vite se tu chon cong ke tiep^)
echo       Dia chi: http://%URL_HOST%:%PORT%/
echo       Luu y  : Nhan Ctrl+C hoac dong cua so nay de dung may chu web.
echo.

if /i "%MODE%"=="dev" (
    call "node_modules\.bin\vite.cmd" %HOST_ARG% --port %PORT% %OPEN_ARG% --clearScreen false
) else (
    call "node_modules\.bin\vite.cmd" preview %HOST_ARG% --port %PORT% %OPEN_ARG% --clearScreen false
)
set "SRV_RC=%errorlevel%"
if not "%SRV_RC%"=="0" (
    if not "%SRV_RC%"=="-1073741510" (
        echo.
        echo [WARN] May chu ket thuc voi ma loi %SRV_RC%.
        pause
        popd >nul 2>&1
        exit /b %SRV_RC%
    )
)
goto :success

rem ===========================================================================
rem Cac ham con
rem ===========================================================================
:run_build_if_needed
if "%NEED_BUILD%"=="1" (
    echo [INFO] Dang bien dich va dong goi Web App ^(npm run build^)...
    call npm run build
    if errorlevel 1 (
        echo [LOI] Build that bai ^(npm run build^). Vui long kiem tra thong bao loi phia tren.
        exit /b 1
    )
    echo [OK]   Build dist/ hoan tat.
) else (
    echo [OK]   Ban build dist/ da moi nhat.
)
exit /b 0

:add_common_node_paths
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
if exist "%LocalAppData%\Programs\nodejs\node.exe" set "PATH=%LocalAppData%\Programs\nodejs;%PATH%"
if defined NVM_SYMLINK if exist "%NVM_SYMLINK%\node.exe" set "PATH=%NVM_SYMLINK%;%PATH%"
if exist "%AppData%\npm" set "PATH=%PATH%;%AppData%\npm"
exit /b 0

:check_node_ready
where node >nul 2>&1
if errorlevel 1 exit /b 1
node -e "const m=Number(process.versions.node.split('.')[0]); if(!(m===18||m===20||m>=22)) process.exit(1)" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:refresh_path
for /f "delims=" %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$m=[Environment]::GetEnvironmentVariable('Path','Machine'); $u=[Environment]::GetEnvironmentVariable('Path','User'); $p=@(); if($m){$p+=$m}; if($u){$p+=$u}; $p -join ';'" 2^>nul') do (
    if not "%%P"=="" set "PATH=%%P;%PATH%"
)
exit /b 0

:install_node_lts
where winget >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Thu cai dat Node.js LTS bang winget...
    winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
    call :refresh_path
    call :add_common_node_paths
    call :check_node_ready
    if not errorlevel 1 exit /b 0
)
echo [INFO] Thu tai va cai dat Node.js LTS chinh thuc tu nodejs.org...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $arch=if($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64'){'arm64'}else{'x64'}; $r=Invoke-RestMethod 'https://nodejs.org/dist/index.json' -TimeoutSec 20; $lts=$null; foreach($x in $r){ if($x.lts){ $lts=$x; break } }; if(-not $lts){ throw 'Khong xac dinh duoc ban Node.js LTS' }; $v=$lts.version; $ok=$false; if($lts.files -contains ('win-' + $arch + '-msi')){ $msi=Join-Path $env:TEMP ('node-' + $v + '-' + $arch + '.msi'); $url='https://nodejs.org/dist/' + $v + '/node-' + $v + '-' + $arch + '.msi'; try { Write-Host ('Dang tai ' + $url); Invoke-WebRequest -Uri $url -OutFile $msi -UseBasicParsing; $p=Start-Process 'msiexec.exe' -ArgumentList @('/i',$msi,'/passive','/norestart') -Wait -PassThru; if($p.ExitCode -eq 0 -or $p.ExitCode -eq 3010){ $ok=$true } } catch {} finally { Remove-Item $msi -Force -ErrorAction SilentlyContinue } }; if(-not $ok){ $zipName='node-' + $v + '-win-' + $arch; $zipUrl='https://nodejs.org/dist/' + $v + '/' + $zipName + '.zip'; $zip=Join-Path $env:TEMP ($zipName + '.zip'); $dst=Join-Path $env:LOCALAPPDATA 'Programs\nodejs'; Write-Host ('Cai dat portable khong can quyen Admin tu ' + $zipUrl); Invoke-WebRequest -Uri $zipUrl -OutFile $zip -UseBasicParsing; New-Item -ItemType Directory -Force -Path $dst | Out-Null; $ext=Join-Path $env:TEMP ($zipName + '-ext'); Remove-Item $ext -Recurse -Force -ErrorAction SilentlyContinue; Expand-Archive -Path $zip -DestinationPath $ext -Force; Copy-Item (Join-Path $ext ($zipName + '\*')) -Destination $dst -Recurse -Force; Remove-Item $zip,$ext -Recurse -Force -ErrorAction SilentlyContinue }"
exit /b 0

:show_help
echo Cach dung: start-webapp.bat [tuy chon]
echo   ^(khong tham so^) : Tu kiem tra Node/thu vien/build va mo web (Vite preview)
echo   --dev           : Chay che do dev server (Vite HMR, cong mac dinh 5173)
echo   --rebuild       : Ep build lai dist/ truoc khi mo web
echo   --install       : Ep cai lai thu vien npm
echo   --lan           : Mo truy cap mang LAN (--host 0.0.0.0)
echo   --port ^<so^>     : Chi dinh cong may chu (mac dinh 4173, dev 5173)
echo   --no-open       : Chi bat server, khong tu mo trinh duyet
echo   --check         : Chi kiem tra/cai dat/build xong roi thoat
echo   --help          : Hien thi huong dan nay
goto :success

:fail
echo.
pause
popd >nul 2>&1
exit /b 1

:success
popd >nul 2>&1
exit /b 0
