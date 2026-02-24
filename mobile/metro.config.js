import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDefaultConfig } from 'expo/metro-config.js';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);

var config = getDefaultConfig(__dirname);

config.watchFolders = [path.resolve(__dirname, '..')];

if (!config.resolver.assetExts.includes('fbx')) {
  config.resolver.assetExts.push('fbx');
}

export default config;
