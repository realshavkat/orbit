# Microsoft tools in English: their French messages ("è"...) crash mach's
# output reader, which then blocks the whole build.
export VSLANG=1033
export PYTHONUTF8=1
export GIT_DIR="$PWD/engine/.git"
SURFER_MOZCONFIG_ONLY=1 npx surfer build --skip-patch-check < .dev/build.log 2>&1
unset GIT_DIR
cd engine
export ACCEPTED_MAR_CHANNEL_IDS=release MAR_CHANNEL_ID=release
./mach build >> ../.dev/build.log 2>&1
echo "BUILD_EXIT=$?" >> ../.dev/build.log
