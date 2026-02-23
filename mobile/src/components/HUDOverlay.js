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
  var health = useGameState(function (state) { return state.health; });
  var ammo = useGameState(function (state) { return state.ammo; });
  var boosts = useGameState(function (state) { return state.boosts; });
  var classConfig = useGameState(function (state) { return state.classConfig; });
  var abilityState = useGameState(function (state) { return state.abilityState; });
  var waveManager = useGameState(function (state) { return state.waveManager; });
  var enemyCount = useGameState(function (state) { return state.enemyCount; });
  var fire = useGameState(function (state) { return state.fire; });
  var reload = useGameState(function (state) { return state.reload; });
  var takeDamage = useGameState(function (state) { return state.takeDamage; });
  var spawnEnemy = useGameState(function (state) { return state.spawnEnemy; });
  var clearEnemy = useGameState(function (state) { return state.clearEnemy; });
  var useBoost = useGameState(function (state) { return state.useBoost; });
  var useAbility = useGameState(function (state) { return state.useAbility; });
  var debugAdvance = useGameState(function (state) { return state.debugAdvance; });

  var abilityStatus = abilityState.active
    ? 'ACTIVE ' + abilityState.activeTimer.toFixed(1) + 's'
    : 'CD ' + abilityState.cooldownTimer.toFixed(1) + 's';

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.topRow}>
        <StatChip label="Ship" value={classConfig.name} />
        <StatChip label="Hull" value={health + '%'} />
        <StatChip label="Ammo" value={String(ammo)} />
        <StatChip label="Wave" value={String(waveManager.wave)} />
        <StatChip label="Enemies" value={String(enemyCount)} />
        <StatChip label="Boost" value={String(boosts)} />
      </View>

      <View style={styles.centerInfo}>
        <Text style={styles.centerInfoText}>State: {waveManager.state}</Text>
        <Text style={styles.centerInfoText}>{classConfig.ability.name}: {abilityStatus}</Text>
      </View>

      <View style={styles.bottomRow}>
        <Pressable style={styles.leftPad} onPress={function () { takeDamage(8); }}>
          <Text style={styles.btnText}>Steer (prototype)</Text>
          <Text style={styles.btnSubText}>Tap = damage test</Text>
        </Pressable>

        <View style={styles.actionButtons}>
          <Pressable style={styles.actionBtn} onPress={fire}><Text style={styles.btnText}>Fire</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={reload}><Text style={styles.btnText}>Reload</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={useBoost}><Text style={styles.btnText}>Boost</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={useAbility}><Text style={styles.btnText}>Ability</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={spawnEnemy}><Text style={styles.btnText}>Spawn Enemy</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={clearEnemy}><Text style={styles.btnText}>Sink Enemy</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={debugAdvance}><Text style={styles.btnText}>Advance Wave</Text></Pressable>
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
  centerInfo: {
    alignSelf: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(1, 15, 33, 0.55)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  centerInfoText: {
    color: '#D3E8FF',
    fontSize: 13
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
    width: 152,
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
  },
  btnSubText: {
    color: '#A2CCFF',
    fontSize: 11,
    marginTop: 4
  }
});
