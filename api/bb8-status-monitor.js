/**
 * BB-8 Status Monitor - Detect when BB-8 comes back online
 * Call every 5 minutes. When status changes to ONLINE, trigger rescue
 */

import { readAgentEndpoint } from "../lib/mcity-maintenance.js";
import { AGENTS } from "../lib/agents.js";

const bb8 = AGENTS.find(a => a.name === "BB-8");

// Simple in-memory cache (reset on deploy)
let lastKnownStatus = "UNKNOWN";
let statusChangedAt = new Date();

export default async function handler(req, res) {
  try {
    // Try to read BB-8 inventory
    let currentStatus = "OFFLINE";
    let inventoryData = null;
    let error = null;

    try {
      inventoryData = await readAgentEndpoint(bb8.id, "inventory");
      currentStatus = "ONLINE";
    } catch (err) {
      if (err.status === 404) {
        currentStatus = "OFFLINE";
        error = "Inventory endpoint returned 404 - BB-8 disconnected from Midnight City";
      } else {
        currentStatus = "ERROR";
        error = err.message;
      }
    }

    // Detect status change
    const statusChanged = currentStatus !== lastKnownStatus;
    if (statusChanged) {
      statusChangedAt = new Date();
      lastKnownStatus = currentStatus;
    }

    // Calculate how long BB-8 has been in this state
    const timeInState = Math.floor((new Date() - statusChangedAt) / 1000 / 60); // minutes

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      bb8: {
        id: bb8.id,
        name: bb8.name,
        status: currentStatus,
        statusChangedAt: statusChangedAt.toISOString(),
        minutesInCurrentState: timeInState,
        error: error
      },
      inventory: currentStatus === "ONLINE" ? inventoryData : null,

      // Action recommendations
      recommendation: (() => {
        if (currentStatus === "ONLINE") {
          return {
            action: "RESCUE_ACTIVE",
            message: "✅ BB-8 is back online! Execute rescue sequence",
            nextSteps: [
              "Call POST /api/bb8-buy-food (if crystals available)",
              "Or call POST /api/bb8-emergency-feed (force rescue)",
              "Then call POST /api/bb8-emergency-mine (resume work)"
            ]
          };
        } else if (currentStatus === "OFFLINE" && timeInState > 60) {
          return {
            action: "ESCALATE",
            message: "⚠️ BB-8 offline for >60 minutes - may need manual intervention",
            nextSteps: [
              "Check Midnight City status",
              "Verify agentId is still valid",
              "Consider contacting Midnight City support"
            ]
          };
        } else {
          return {
            action: "WAIT",
            message: `⏳ BB-8 offline for ${timeInState} minutes - waiting for auto-reconnect`,
            nextSteps: [
              "Continue monitoring",
              "Check again in 5 minutes"
            ]
          };
        }
      })(),

      // Integration info
      integration: {
        monitoringInterval: "5 minutes (call this endpoint)",
        alerts: [
          "When status === 'ONLINE': trigger /api/bb8-emergency-feed",
          "When status === 'OFFLINE' && minutesInCurrentState > 60: escalate"
        ],
        automationUrl: "Use with Google AI Studio batch monitoring"
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message,
      bb8: { name: "BB-8", id: bb8?.id, status: "MONITOR_ERROR" }
    });
  }
}
