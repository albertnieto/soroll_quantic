import pennylane as qml
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

dev = qml.device('default.qubit', wires=4)

@qml.qnode(dev)
def bell_state_circuit():
    qml.Hadamard(wires=0)
    qml.CNOT(wires=[0, 1])
    qml.Hadamard(wires=2)
    qml.CNOT(wires=[2, 3])
    qml.RY(0.5, wires=0)
    qml.RY(0.5, wires=2)
    return qml.state()

bell_state_circuit()

fig, ax = qml.draw_mpl(bell_state_circuit, style='black_white')()
fig.patch.set_facecolor('white')
ax.set_facecolor('white')
plt.savefig('circuits/circuit_diagram.png', dpi=150, bbox_inches='tight', facecolor='white', edgecolor='none')
print("Circuit diagram saved to circuits/circuit_diagram.png")
