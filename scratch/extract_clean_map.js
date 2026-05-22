const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\marivana\\.gemini\\antigravity\\brain';
const outputDir = 'C:\\Users\\marivana\\Desktop\\SeaPirate\\scratch';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function getFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getFiles(filePath, fileList);
    } else if (file === 'overview.txt') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

try {
  const logs = getFiles(brainDir);
  console.log(`Found ${logs.length} overview logs.`);
  
  let extractedCount = 0;
  
  for (const logPath of logs) {
    const convId = path.basename(path.dirname(path.dirname(path.dirname(logPath))));
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum].trim();
      if (!line) continue;
      
      try {
        const step = JSON.parse(line);
        
        // Check 1: Tool call of type write_to_file
        if (step.tool_calls) {
          for (const call of step.tool_calls) {
            if (call.name === 'write_to_file') {
              const args = call.args || {};
              const target = args.TargetFile || '';
              if (target.includes('map.html')) {
                let code = args.CodeContent || '';
                if (code.includes('<!DOCTYPE html>') || code.includes('<html>')) {
                  extractedCount++;
                  const filename = `map_write_step_${step.step_index}_from_${convId}.html`;
                  fs.writeFileSync(path.join(outputDir, filename), code, 'utf8');
                  console.log(`[WRITE] Extracted map.html from step ${step.step_index} in conv ${convId} -> ${filename}`);
                }
              }
            }
          }
        }
        
        // Check 2: Content field (chat message) containing a markdown html block
        if (step.content && typeof step.content === 'string') {
          const msg = step.content;
          let searchPos = 0;
          while (true) {
            const codeBlockStart = msg.indexOf('```html', searchPos);
            if (codeBlockStart === -1) break;
            
            const codeBlockEnd = msg.indexOf('```', codeBlockStart + 7);
            if (codeBlockEnd === -1) break;
            
            const htmlContent = msg.substring(codeBlockStart + 7, codeBlockEnd).trim();
            searchPos = codeBlockEnd + 3;
            
            if (htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('map-header') || htmlContent.includes('scanNPC')) {
              extractedCount++;
              const filename = `map_msg_step_${step.step_index}_from_${convId}.html`;
              fs.writeFileSync(path.join(outputDir, filename), htmlContent, 'utf8');
              console.log(`[MSG] Extracted map.html markdown block from step ${step.step_index} in conv ${convId} -> ${filename}`);
            }
          }
        }
      } catch (err) {
        // Line wasn't valid JSON, skip
      }
    }
  }
  console.log(`Finished extraction. Total pristine versions written: ${extractedCount}`);
} catch (err) {
  console.error('Error during step extraction:', err);
}
