import React, { useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGameState } from '../game/state/useGameState';

function StatChip(props) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{props.label}</Text>
      <Text style={styles.chipValue}>{props.value}</Text>
    </View>
  );
}

function JoystickPad() {
  var setSteering = useGameState(function (state) { return state.setSteering; });
  var panResponder = useMemo(function () {
    return PanResponder.create({
      onStartShouldSetPanResponder: function () { return true; },
      onMoveShouldSetPanResponder: function () { return true; },
      onPanResponderMove: function (_, gesture) {
        setSteering(
          Math.max(-1, Math.min(1, gesture.dx / 55)),
          Math.max(-1, Math.min(1, gesture.dy / 55))
        );
      },
      onPanResponderRelease: function () {
        setSteering(0, 0);
      },
      onPanResponderTerminate: function () {
        setSteering(0, 0);
      }
    });
  }, [setSteering]);

  return (
    <View style={styles.leftPad} {...panResponder.panHandlers}>
      <Text style={styles.btnText}>Joystick</Text>
      <Text style={styles.btnSubText}>Drag to steer</Text>
    </View>
  );
}

function TechPanel() {
  var [expanded, setExpanded] = useState(false);
  var gold = useGameState(function (state) { return state.gold; });
  var unlockTechNode = useGameState(function (state) { return state.unlockTechNode; });

  if (!expanded) {
    return (
      <Pressable style={styles.techPanelCollapsed} onPress={function () { setExpanded(true); }}>
        <Text style={styles.techTitle}>Tech Tree</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.techPanel}>
      <View style={styles.techHeaderRow}>
        <Text style={styles.techTitle}>Tech Tree (migration slice)</Text>
        <Pressable onPress={function () { setExpanded(false); }}>
          <Text style={styles.techCollapse}>Hide</Text>
        </Pressable>
      </View>
      <Text style={styles.techText}>Gold: {gold}</Text>
      <View style={styles.techRow}>
        <Pressable style={styles.techBtn} onPress={function () { unlockTechNode('offense', 0); }}><Text style={styles.btnText}>+DMG 40</Text></Pressable>
        <Pressable style={styles.techBtn} onPress={function () { unlockTechNode('defense', 0); }}><Text style={styles.btnText}>+HP 40</Text></Pressable>
        <Pressable style={styles.techBtn} onPress={function () { unlockTechNode('utility', 0); }}><Text style={styles.btnText}>+Gold 120</Text></Pressable>
      </View>
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
  var enemyCount = useGameState(function (state) { return state.combat.enemies.length; });
  var playerSpeed = useGameState(function (state) { return state.combat.player.speed; });
  var playerX = useGameState(function (state) { return state.combat.player.x; });
  var playerZ = useGameState(function (state) { return state.combat.player.z; });
  var totalKills = useGameState(function (state) { return state.totalKills; });
  var banner = useGameState(function (state) { return state.waveBanner; });
  var fire = useGameState(function (state) { return state.fire; });
  var reload = useGameState(function (state) { return state.reload; });
  var useBoost = useGameState(function (state) { return state.useBoost; });
  var endBoost = useGameState(function (state) { return state.endBoost; });
  var useAbility = useGameState(function (state) { return state.useAbility; });
  var restartRun = useGameState(function (state) { return state.restartRun; });
  var timeLabel = useGameState(function (state) { return state.timeLabel; });
  var weatherLabel = useGameState(function (state) { return state.weatherLabel; });
  var cycleWeatherNow = useGameState(function (state) { return state.cycleWeatherNow; });

  var abilityStatus = abilityState.active
    ? 'ACTIVE ' + abilityState.activeTimer.toFixed(1) + 's'
    : 'CD ' + abilityState.cooldownTimer.toFixed(1) + 's';

  var isFinished = waveManager.state === 'GAME_OVER' || waveManager.state === 'VICTORY';

  return (
    <View pointerEvents="auto" style={styles.container}>
      <View style={styles.topRow}>
        <StatChip label="Ship" value={classConfig.name} />
        <StatChip label="Hull" value={health.toFixed(0) + '%'} />
        <StatChip label="Ammo" value={String(ammo)} />
        <StatChip label="Wave" value={String(waveManager.wave)} />
        <StatChip label="Enemies" value={String(enemyCount)} />
        <StatChip label="Kills" value={String(totalKills)} />
        <StatChip label="Speed" value={playerSpeed.toFixed(1)} />
        <StatChip label="Pos" value={playerX.toFixed(1) + ',' + playerZ.toFixed(1)} />
        <StatChip label="Boost" value={String(boosts)} />
        <StatChip label="Time" value={timeLabel} />
        <Pressable onPress={cycleWeatherNow}><StatChip label="Weather" value={weatherLabel} /></Pressable>
      </View>

      <View style={styles.centerInfo}>
        <Text style={styles.centerInfoText}>{banner}</Text>
        <Text style={styles.centerInfoText}>{classConfig.ability.name}: {abilityStatus}</Text>
      </View>

      <TechPanel />

      {isFinished ? (
        <View style={styles.resultModal}>
          <Text style={styles.resultTitle}>{waveManager.state === 'VICTORY' ? 'Victory' : 'Defeat'}</Text>
          <Text style={styles.resultBody}>Waves survived: {waveManager.wave}</Text>
          <Text style={styles.resultBody}>Ships sunk: {totalKills}</Text>
          <Pressable style={styles.modalButton} onPress={restartRun}>
            <Text style={styles.btnText}>Start New Run</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <JoystickPad />
        <View style={styles.actionButtons}>
          <Pressable style={styles.actionBtn} onPress={fire}><Text style={styles.btnText}>Fire</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={reload}><Text style={styles.btnText}>Reload</Text></Pressable>
          <Pressable style={styles.actionBtn} onPressIn={useBoost} onPressOut={endBoost}><Text style={styles.btnText}>Boost Hold</Text></Pressable>
          <Pressable style={styles.actionBtn} onPress={useAbility}><Text style={styles.btnText}>Ability</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

var styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', paddingVertical: 18, paddingHorizontal: 16, zIndex: 20, elevation: 20 },
  topRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignSelf: 'center', justifyContent: 'center' },
  centerInfo: { alignSelf: 'center', alignItems: 'center', backgroundColor: 'rgba(1, 15, 33, 0.55)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  centerInfoText: { color: '#D3E8FF', fontSize: 13 },
  chip: { backgroundColor: 'rgba(1, 15, 33, 0.75)', borderColor: '#68B0FF', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, minWidth: 64 },
  chipLabel: { color: '#A2CCFF', fontSize: 11 },
  chipValue: { color: '#F0F7FF', fontWeight: '700', fontSize: 14 },
  techPanelCollapsed: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#68B0FF' },
  techPanel: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, padding: 8, gap: 6 },
  techHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  techTitle: { color: '#d8e8ff', fontWeight: '700' },
  techCollapse: { color: '#9dcaff', fontSize: 12, fontWeight: '700' },
  techText: { color: '#d8e8ff', fontSize: 12 },
  techRow: { flexDirection: 'row', gap: 8 },
  techBtn: { borderWidth: 1, borderColor: '#68B0FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(7, 40, 76, 0.85)' },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  leftPad: { width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(7, 40, 76, 0.7)', borderWidth: 1, borderColor: '#68B0FF', alignItems: 'center', justifyContent: 'center' },
  actionButtons: { gap: 8, alignItems: 'flex-end' },
  actionBtn: { width: 150, borderRadius: 12, backgroundColor: 'rgba(7, 40, 76, 0.85)', borderColor: '#68B0FF', borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  btnText: { color: '#F0F7FF', fontWeight: '700' },
  btnSubText: { color: '#A2CCFF', fontSize: 11, marginTop: 4 },
  resultModal: { position: 'absolute', top: '35%', left: '32%', right: '32%', backgroundColor: 'rgba(0, 16, 34, 0.92)', borderColor: '#68B0FF', borderWidth: 1, borderRadius: 12, alignItems: 'center', padding: 16, gap: 8 },
  resultTitle: { color: '#F0F7FF', fontSize: 24, fontWeight: '700' },
  resultBody: { color: '#cfe2ff', fontSize: 14 },
  modalButton: { marginTop: 8, width: '100%', borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(7, 40, 76, 1)', borderColor: '#68B0FF', borderWidth: 1 }
});
