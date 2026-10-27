# ⚡ SmartGrid RL: Intelligent Energy Management for Smart Buildings

**Batch 13 | B.Tech Project**

A web-based smart-building energy management platform that simulates, monitors, analyzes, and optimizes energy consumption using Reinforcement Learning concepts.

🌐 Live Website

Explore the project here:

🚀 Live Demo: https://reinforcement-learning-framework-fo.vercel.app

## 📌 Overview

SmartGrid RL aims to improve energy efficiency in smart buildings while balancing electricity costs, equipment operation, and occupant comfort.

Traditional energy management systems often rely on fixed rules and schedules. Our platform provides a simulation environment to evaluate building conditions, compare control strategies, identify unusual energy patterns, and explore energy-saving opportunities.

The system currently uses simulated building data and includes an interface for Deep Q-Network (DQN) training and evaluation.

## 🎯 Objectives

- Reduce building energy consumption and operating costs.
- Maintain indoor temperature within a defined comfort range.
- Simulate and monitor building equipment and energy demand.
- Explore Reinforcement Learning for intelligent energy control.
- Compare intelligent control strategies against a rule-based baseline.
- Detect abnormal energy usage and comfort violations.
- Evaluate alternative operating conditions through scenario analysis.

## ✨ Features

### 1. Dashboard
- Current power demand and daily energy consumption.
- Estimated electricity costs and baseline comparisons.
- Indoor temperature and occupancy indicators.
- Energy consumption and cost trend charts.

### 2. Building Management
- Configure multiple simulated buildings.
- Define floor area, number of floors, and building type.
- Set operating hours, energy targets, and comfort limits.

### 3. Equipment Management
Simulates five major equipment categories:
- HVAC systems and heat pumps.
- LED lighting.
- Electrical appliances and plug loads.
- Battery energy storage.
- Rooftop solar photovoltaic generation.

Users can adjust supported controls and simulate equipment faults.

### 4. Live Monitoring
- Advance the simulation continuously or one step at a time.
- Configure simulation intervals.
- Select the available controller.
- Display and store simulated energy readings.

### 5. Reinforcement Learning Control Center
- Configure the Deep Q-Network (DQN) training environment.
- Set simulation duration and training episodes.
- Configure weather, occupancy, electricity pricing, and comfort limits.
- Adjust reward-function weights.
- View training progress and manage saved experiments or models, where implemented.

### 6. Optimization
- Compare current and recommended equipment settings.
- Estimate potential energy and cost savings.
- Evaluate changes in comfort deviation.
- Apply supported recommendations.

### 7. Anomaly Detection and Alerts
Detects unusual simulated conditions using rules such as:
- Abnormally high energy consumption.
- Unexpected energy usage outside operating hours.
- Deviations from a rolling energy baseline.
- Indoor temperatures outside the comfort range.

Filter alerts by severity, status, and building.

### 8. What-If Analysis
Evaluate different simulated scenarios by adjusting:
- Building occupancy.
- Electricity prices.
- Outdoor temperature.
- HVAC settings.
- Opening and closing hours.
- Lighting limits.
- Battery capacity and initial charge.
- Reward-function weights.

### 9. Baseline Comparison
Provides a framework for comparing a fixed-rule controller against an RL policy under equivalent simulation conditions.

### 10. Reports
- Daily, weekly, and monthly summaries.
- Energy and cost statistics.
- Baseline and savings comparisons.
- Equipment-level energy measurements.
- CSV and PDF export options.

### 11. Settings
- Configure electricity tariffs.
- Set default indoor comfort limits.
- Configure simulation random seeds.
- Select measurement units and timezone.
- Manage profile and notification settings.

## 🧠 Reinforcement Learning Approach

The project explores Reinforcement Learning as a method for learning energy-control strategies.

**Algorithm:** Deep Q-Network (DQN)

The main components are:

| Component | Description |
|---|---|
| State | Simulated building conditions, energy demand, occupancy, temperature, and equipment status |
| Action | Available equipment-control decisions |
| Reward | Feedback balancing energy consumption, cost, comfort, and equipment-related considerations |
| Environment | Simulated smart-building operating conditions |
| Evaluation | Energy consumption, cost, peak power, comfort violations, and cumulative reward |

The training objective is to learn a policy that maximizes cumulative reward while balancing energy efficiency and occupant comfort.

> **Note:** The current interface uses simulated data. A trained RL model must be successfully trained, loaded, and evaluated before results can be attributed to the learned policy.

## 🏗️ System Workflow

1. Configure the building and equipment.
2. Set operating schedules, electricity tariffs, and comfort limits.
3. Generate simulated building conditions and energy readings.
4. Run the selected controller or train the DQN agent.
5. Evaluate energy consumption, costs, and comfort.
6. Compare performance against the rule-based baseline.
7. Analyze anomalies and test alternative scenarios.
8. Generate reports and export results.

## 📊 Performance Metrics

The platform is designed to evaluate:

- **Energy consumption:** Total energy used, measured in kWh.
- **Energy savings:** Reduction relative to the baseline.
- **Cost reduction:** Difference in estimated electricity costs.
- **Peak grid demand:** Maximum power demand, measured in kW.
- **Comfort violations:** Time spent outside the configured comfort range.
- **Cumulative reward:** Total reward collected by the RL agent during an episode.

Reported improvements should be validated using consistent simulation conditions and repeated experiments.

## 🛠️ Technology Stack

The platform provides a web-based dashboard and a simulation-oriented energy management workflow.

Update the following list to match the actual dependencies in your repository:

- **Frontend:** Web-based user interface.
- **Charts:** Energy consumption and performance visualizations.
- **Backend / Data Storage:** As implemented in the project.
- **Simulation:** Synthetic building and equipment data.
- **Machine Learning:** Deep Q-Network (DQN), where implemented.
- **Version Control:** Git and GitHub.

## 🚀 Getting Started

### Prerequisites

Install the software required by your project's actual implementation. Depending on your stack, this may include:

- Node.js and npm.
- Python.
- Git.

### Installation

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_FOLDER>
```

Install the dependencies using the package manager specified by your project.

For a Node.js project:

```bash
npm install
```

For a Python project, if it contains a `requirements.txt` file:

```bash
pip install -r requirements.txt
```

Start the application using the scripts or commands defined in your project configuration.

For example, a Vite frontend commonly runs with:

```bash
npm run dev
```

**Important:** These are common setup examples, not verified commands for every project configuration. Follow the repository's actual package files and scripts.

## 🔒 Data and Safety

- The current demonstration uses simulated building data.
- Energy savings and cost reductions are estimates derived from the configured simulation.
- No physical building equipment is controlled by the current demonstration.
- Real-world deployment would require suitable hardware integrations, validation, access controls, and equipment safety mechanisms.

## 🔮 Future Enhancements

- Integration with real-time IoT sensors.
- Weather forecasts and dynamic electricity pricing.
- Training and evaluating additional RL algorithms.
- Improved multi-building optimization.
- Predictive maintenance and advanced anomaly detection.
- Real-time demand-response management.
- Deployment to validated building automation systems.

## 👥 Project Information

- **Batch:** 13
- **Project Title:** Reinforcement Learning Framework for Intelligent Energy Management in Smart Buildings
- **Platform Name:** SmartGrid RL
- **Project Type:** B.Tech Academic Project

## 📄 License

Choose and add an appropriate open-source license if you intend to distribute this project publicly.

---

**SmartGrid RL — Toward smarter, more efficient, and sustainable buildings.**
