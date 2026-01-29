package com.tekcin.mrbeanbot.android.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class MrBeanBotProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", MrBeanBotCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", MrBeanBotCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", MrBeanBotCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", MrBeanBotCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", MrBeanBotCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", MrBeanBotCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", MrBeanBotCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", MrBeanBotCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", MrBeanBotCapability.Canvas.rawValue)
    assertEquals("camera", MrBeanBotCapability.Camera.rawValue)
    assertEquals("screen", MrBeanBotCapability.Screen.rawValue)
    assertEquals("voiceWake", MrBeanBotCapability.VoiceWake.rawValue)
  }

  @Test
  fun screenCommandsUseStableStrings() {
    assertEquals("screen.record", MrBeanBotScreenCommand.Record.rawValue)
  }
}
