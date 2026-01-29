package com.tekcin.mrbeanbot.android.ui

import androidx.compose.runtime.Composable
import com.tekcin.mrbeanbot.android.MainViewModel
import com.tekcin.mrbeanbot.android.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}
