import pennylane as qml
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

dev = qml.device("default.qubit", wires=4)


@qml.qnode(dev)
def bell_state_circuit():
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    qml.Hadamard(wires=2)
    qml.CNOT(wires=[2, 3])
    qml.RY(0.5, wires=0)
    qml.RY(0.5, wires=2)
    return qml.state()


@qml.qnode(dev)
def phase_evolution_circuit():
    qml.Hadamard(wires=0)
    qml.RZ(0.3, wires=0)
    qml.Hadamard(wires=1)
    qml.RZ(0.5, wires=1)
    qml.CNOT(wires=[0, 1])
    qml.RY(0.4, wires=0)
    qml.RY(0.6, wires=1)
    qml.Hadamard(wires=2)
    qml.RZ(0.7, wires=2)
    qml.Hadamard(wires=3)
    qml.RZ(0.9, wires=3)
    qml.CNOT(wires=[2, 3])
    qml.RY(0.8, wires=2)
    qml.RY(1.0, wires=3)
    qml.CNOT(wires=[1, 2])
    qml.RZ(1.2, wires=1)
    qml.RZ(1.4, wires=2)
    qml.RY(1.1, wires=0)
    qml.RY(1.3, wires=3)
    return qml.state()


@qml.qnode(dev)
def random_rotation_circuit():
    for i in range(4):
        qml.Hadamard(wires=i)
    qml.RX(0.5, wires=0)
    qml.RY(0.7, wires=1)
    qml.RZ(0.3, wires=2)
    qml.RX(0.9, wires=3)
    qml.CNOT(wires=[0, 1])
    qml.CNOT(wires=[1, 2])
    qml.CNOT(wires=[2, 3])
    return qml.state()


circuits = {
    "bell_state": bell_state_circuit,
    "phase_evolution": phase_evolution_circuit,
    "random_rotation": random_rotation_circuit,
}

for name, circuit_fn in circuits.items():
    circuit_fn()
    fig, ax = qml.draw_mpl(circuit_fn, style="black_white")()
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    output_path = f"circuits/{name}_diagram.png"
    plt.savefig(
        output_path, dpi=150, bbox_inches="tight", facecolor="white", edgecolor="none"
    )
    plt.close(fig)
    print(f"Circuit diagram saved to {output_path}")

# Also save the legacy filename for backwards compatibility
bell_state_circuit()
fig, ax = qml.draw_mpl(bell_state_circuit, style="black_white")()
fig.patch.set_facecolor("white")
ax.set_facecolor("white")
plt.savefig(
    "circuits/circuit_diagram.png",
    dpi=150,
    bbox_inches="tight",
    facecolor="white",
    edgecolor="none",
)
plt.close(fig)
print("Legacy circuit_diagram.png saved")
