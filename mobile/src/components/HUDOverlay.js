import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameState } from '../game/state/useGameState';

function StatChip(props) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{props.label}</Text>
      <Text style={styles.chipValue}>{props.value}</Text>
    </View>
  );
}

export default function HUDOverlay() {
  var health = useGameState(function (state) {
    return state.health;
  });
  var ammo = useGameState(function (state) {
    return state.ammo;
  });
  var wave = useGameState(function (state) {
    return state.wave;
  });
  var boosts = useGameState(function (state) {
    return state.boosts;
  });
  var fire = useGameState(function (state) {
    return state.fire;
  });
  var reload = useGameState(function (state) {
    return state.reload;
  });
  var takeDamage = useGameState(function (state) {
    return state.takeDamage;
  });
  var nextWave = useGameState(function (state) {
    return state.nextWave;
  });
  var useBoost = useGameState(function (state) {
    return state.useBoost;
  });

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.topRow}>
        <StatChip label="Hull" value={health + '%'} />
        <StatChip label="Ammo" value={String(ammo)} />
        <StatChip label="Wave" value={String(wave)} />
        <StatChip label="Boost" value={String(boosts)} />
      </View>

      <View style={styles.bottomRow}>
        <Pressable style={styles.leftPad} onPress={function () { takeDamage(8); }}>
          <Text style={styles.btnText}>Joystick (prototype)</Text>
        </Pressable>

        <View style={styles.actionButtons}>
          <Pressable style={styles.actionBtn} onPress={fire}>
            <Text style={styles.btnText}>Fire</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={reload}>
            <Text style={styles.btnText}>Reload</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={useBoost}>
            <Text style={styles.btnText}>Boost</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={nextWave}>
            <Text style={styles.btnText}>Next Wave</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 16
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'center'
  },
  chip: {
    backgroundColor: 'rgba(1, 15, 33, 0.75)',
    borderColor: '#68B0FF',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 82
  },
  chipLabel: {
    color: '#A2CCFF',
    fontSize: 12
  },
  chipValue: {
    color: '#F0F7FF',
    fontWeight: '700',
    fontSize: 16
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  leftPad: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(7, 40, 76, 0.7)',
    borderWidth: 1,
    borderColor: '#68B0FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionButtons: {
    gap: 8,
    alignItems: 'flex-end'
  },
  actionBtn: {
    width: 140,
    borderRadius: 12,
    backgroundColor: 'rgba(7, 40, 76, 0.85)',
    borderColor: '#68B0FF',
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center'
  },
  btnText: {
    color: '#F0F7FF',
    fontWeight: '700'
  }
});
