import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import OceanScene from './components/OceanScene';
import HUDOverlay from './components/HUDOverlay';
import { useGameState } from './game/state/useGameState';

export default function App() {
  var tick = useGameState(function (state) { return state.tick; });

  useEffect(function () {
    var last = Date.now();
    var interval = setInterval(function () {
      var now = Date.now();
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      tick(dt);
    }, 1000 / 30);

    return function () {
      clearInterval(interval);
    };
  }, [tick]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaView style={styles.root}>
        <View style={styles.root}>
          <OceanScene />
          <HUDOverlay />
          <StatusBar style="light" />
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

var styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#001B2E'
  }
});
