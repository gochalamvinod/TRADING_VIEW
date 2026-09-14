const fs = require('fs');

let content = fs.readFileSync('chart_app.js', 'utf8');

const sIdx = content.indexOf('peProto._m18Patched = true;');
const eIdx = content.indexOf('5. Two-Finger Tap');

if (sIdx === -1 || eIdx === -1) {
  console.error("Anchors not found", sIdx, eIdx);
  process.exit(1);
}

// Find the start of the comment block before "5. Two-Finger Tap"
const commentStart = content.lastIndexOf('/*', eIdx);

const replacement = `peProto._m18Patched = true;
              }

              // Accelerate countdown loop to 60 FPS (requestAnimationFrame)
              if (mainSeries._countdownUpdateTimer) {
                mainSeries._model.clearInterval(mainSeries._countdownUpdateTimer);
                mainSeries._countdownUpdateTimer = null;
              }
              function animateCountdown() {
                mainSeries._priceAxisView?.updateCountdown?.();
                mainSeries._projectionPriceAxisView?.updateCountdown?.();
                requestAnimationFrame(animateCountdown);
              }
              const renderLoop = animateCountdown;
              requestAnimationFrame(renderLoop);
            }
          } catch (e) {
            console.warn("[M18] Runtime PriceAxisView patch warning:", e);
          }

          `;

content = content.substring(0, sIdx) + replacement + content.substring(commentStart);
fs.writeFileSync('chart_app.js', content, 'utf8');
console.log("chart_app.js cleanly updated!");
