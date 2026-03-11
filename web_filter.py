import numpy as np

class WebParticleFilter:
    """
    Pure-NumPy implementation of a Bootstrap Particle Filter.
    Optimized for Pyodide (browser) environment where TensorFlow is unavailable.
    """
    def __init__(self, model, num_particles=500):
        self.model = model
        self.num_particles = num_particles
        self.particles = None
        self.weights = None
        
    def initialize(self, initial_state=None):
        if initial_state is None:
            initial_state = np.array([0.0, -0.5, 0.0])
        self.particles = self.model.transition(initial_state, num_particles=self.num_particles)
        self.weights = np.ones(self.num_particles) / self.num_particles
        
    def step(self, observation):
        # 1. Transition
        self.particles = self.model.transition(self.particles, num_particles=self.num_particles)
        
        # 2. Likelihood
        log_liks = self.model.log_likelihood(self.particles, observation)
        
        # 3. Update Weights (Log-Sum-Exp Trick for stability)
        max_log_lik = np.max(log_liks)
        self.weights *= np.exp(log_liks - max_log_lik)
        self.weights /= np.sum(self.weights)
        
        # 4. Resample if ESS is low
        ess = 1.0 / np.sum(self.weights**2)
        if ess < self.num_particles / 2:
            self.resample()
            
        return self.particles, self.weights

    def resample(self):
        """Systematic resampling (pure NumPy)"""
        indices = self.systematic_resample(self.weights)
        self.particles = self.particles[indices]
        self.weights = np.ones(self.num_particles) / self.num_particles

    @staticmethod
    def systematic_resample(weights):
        N = len(weights)
        positions = (np.arange(N) + np.random.random()) / N
        cumulative_sum = np.cumsum(weights)
        indices = np.zeros(N, dtype=int)
        i, j = 0, 0
        while i < N:
            if positions[i] < cumulative_sum[j]:
                indices[i] = j
                i += 1
            else:
                j += 1
        return indices

    def forecast(self, horizon=60, num_sims=100):
        """
        Generate forward simulations from current particle cloud.
        Used for calculating crisis probabilities.
        """
        # Select base particles for simulation
        idx = np.random.choice(self.num_particles, size=num_sims, p=self.weights)
        sim_particles = self.particles[idx].copy()
        
        trajectories = np.zeros((horizon, num_sims, 3))
        for t in range(horizon):
            sim_particles = self.model.transition(sim_particles, num_particles=num_sims)
            trajectories[t] = sim_particles
            
        return trajectories
