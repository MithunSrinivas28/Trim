import torch
import torch.nn as nn


class LSTMForecaster(nn.Module):
    """
    Many-to-many LSTM forecaster.
    Input:  (batch, seq_len=20, features=2)   — 20 historical readings of [cpuPercent, memoryPercent]
    Output: (batch, horizon=10, features=2)    — 10 predicted future readings
    """

    def __init__(self, input_size=2, hidden_size=64, num_layers=1, forecast_horizon=10):
        super(LSTMForecaster, self).__init__()
        self.forecast_horizon = forecast_horizon
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # Encoder LSTM — processes the input sequence
        self.encoder = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
        )

        # Decoder LSTM — autoregressively generates the forecast
        self.decoder = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
        )

        # Projects hidden state back to feature space
        self.fc = nn.Linear(hidden_size, input_size)

    def forward(self, x):
        # x shape: (batch, seq_len=20, input_size=2)

        # Encode — run input through encoder, keep final hidden/cell state
        _, (hidden, cell) = self.encoder(x)

        # Seed the decoder with the last timestep of the input
        decoder_input = x[:, -1:, :]  # (batch, 1, input_size)

        outputs = []
        for _ in range(self.forecast_horizon):
            decoder_out, (hidden, cell) = self.decoder(decoder_input, (hidden, cell))
            step_pred = self.fc(decoder_out)  # (batch, 1, input_size)
            outputs.append(step_pred)
            decoder_input = step_pred  # feed prediction as next input

        # Stack along time axis → (batch, forecast_horizon, input_size)
        forecast = torch.cat(outputs, dim=1)
        return forecast