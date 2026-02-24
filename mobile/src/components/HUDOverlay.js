import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
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

  function handleGesture(event) {
    var tx = event.nativeEvent.translationX;
    var ty = event.nativeEvent.translationY;
    var x = Math.max(-1, Math.min(1, tx / 55));
    var y = Math.max(-1, Math.min(1, ty / 55));
    setSteering(x, y);
  }

  function handleState(event) {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED || event.nativeEvent.state === State.FAILED) {
      setSteering(0, 0);
    }
  }

  return (
    <PanGestureHandler onGestureEvent={handleGesture} onHandlerStateChange={handleState}>
      <View style={styles.leftPad}>
        <Text style={styles.btnText}>Joystick</Text>
        <Text style={styles.btnSubText}>Drag to steer</Text>
      </View>
    </PanGestureHandler>
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
  var totalKills = useGameState(function (state) { return state.totalKills; });
  var banner = useGameState(function (state) { return state.waveBanner; });
  var fire = useGameState(function (state) { return state.fire; });
  var reload = useGameState(function (state) { return state.reload; });
  var useBoost = useGameState(function (state) { return state.useBoost; });
  var endBoost = useGameState(function (state) { return state.endBoost; });
  var useAbility = useGameState(function (state) { return state.useAbility; });
  var restartRun = useGameState(function (state) { return state.restartRun; });

  var abilityStatus = abilityState.active
    ? 'ACTIVE ' + abilityState.activeTimer.toFixed(1) + 's'
    : 'CD ' + abilityState.cooldownTimer.toFixed(1) + 's';

  var isFinished = waveManager.state === 'GAME_OVER' || waveManager.state === 'VICTORY';

  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.topRow}>
        <StatChip label="Ship" value={classConfig.name} />
        <StatChip label="Hull" value={health.toFixed(0) + '%'} />
        <StatChip label="Ammo" value={String(ammo)} />
        <StatChip label="Wave" value={String(waveManager.wave)} />
        <StatChip label="Enemies" value={String(enemyCount)} />
        <StatChip label="Kills" value={String(totalKills)} />
        <StatChip label="Boost" value={String(boosts)} />
      </View>

      <View style={styles.centerInfo}>
        <Text style={styles.centerInfoText}>{banner}</Text>
        <Text style={styles.centerInfoText}>{classConfig.ability.name}: {abilityStatus}</Text>
      </View>

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
    gap: 8,
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
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 70
  },
  chipLabel: {
    color: '#A2CCFF',
    fontSize: 11
  },
  chipValue: {
    color: '#F0F7FF',
    fontWeight: '700',
    fontSize: 14
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  leftPad: {
    width: 150,
    height: 150,
    borderRadius: 75,
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
    width: 150,
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
  },
  resultModal: {
    position: 'absolute',
    top: '35%',
    left: '32%',
    right: '32%',
    backgroundColor: 'rgba(0, 16, 34, 0.92)',
    borderColor: '#68B0FF',
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    padding: 16,
    gap: 8
  },
  resultTitle: {
    color: '#F0F7FF',
    fontSize: 24,
    fontWeight: '700'
  },
  resultBody: {
    color: '#cfe2ff',
    fontSize: 14
  },
  modalButton: {
    marginTop: 8,
    width: '100%',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(7, 40, 76, 1)',
    borderColor: '#68B0FF',
    borderWidth: 1
  }
});
