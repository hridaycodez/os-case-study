# scheduler_sim.py
# OS Case Study — Scheduling Strategy Simulator
# Simulates 3 strategies placing 12 jobs across 3 nodes
# Run: python scheduler_sim.py

# ──────────────────────────────────────────────
# SETUP: Define our 3 nodes and 12 jobs
# ──────────────────────────────────────────────

# Each node has: CPU cores, RAM (GB), and network latency (ms)
NODES = [
    {"id": "Node A", "total_cpu": 8, "total_ram": 16, "latency_ms": 10},
    {"id": "Node B", "total_cpu": 8, "total_ram": 16, "latency_ms": 35},
    {"id": "Node C", "total_cpu": 4, "total_ram": 8,  "latency_ms": 60},
]

# Each job needs some CPU and RAM to run
JOBS = [
    {"id": f"Job {i+1}", "cpu": [0.5, 1.0, 1.5, 2.0][i % 4], "ram": [1, 2, 1, 3][i % 4]}
    for i in range(12)
]


# ──────────────────────────────────────────────
# HELPER: Make a fresh copy of nodes with 0 usage
# (so each strategy starts from scratch)
# ──────────────────────────────────────────────
def fresh_nodes():
    return [
        {**node, "used_cpu": 0, "used_ram": 0, "assigned_jobs": []}
        for node in NODES
    ]


# ──────────────────────────────────────────────
# STRATEGY 1: Least-Loaded
# Logic: For each job, pick the node with the MOST free CPU
# Goal: Spread jobs evenly across all nodes
# ──────────────────────────────────────────────
def least_loaded(nodes, job):
    # Filter: only nodes that have enough CPU and RAM left
    available = [
        n for n in nodes
        if n["used_cpu"] + job["cpu"] <= n["total_cpu"]
        and n["used_ram"] + job["ram"] <= n["total_ram"]
    ]
    if not available:
        return None
    # Sort by CPU utilization (lowest first = most free)
    return sorted(available, key=lambda n: n["used_cpu"] / n["total_cpu"])[0]


# ──────────────────────────────────────────────
# STRATEGY 2: Binpack
# Logic: For each job, pick the node with the LEAST free CPU
# Goal: Fill up one node before moving to the next (saves power)
# ──────────────────────────────────────────────
def binpack(nodes, job):
    available = [
        n for n in nodes
        if n["used_cpu"] + job["cpu"] <= n["total_cpu"]
        and n["used_ram"] + job["ram"] <= n["total_ram"]
    ]
    if not available:
        return None
    # Sort by CPU utilization (highest first = most used = binpacking)
    return sorted(available, key=lambda n: n["used_cpu"] / n["total_cpu"], reverse=True)[0]


# ──────────────────────────────────────────────
# STRATEGY 3: Network-Aware
# Logic: Score each node using CPU + latency together
# Score = 0.6 × (free CPU %) + 0.4 × (1 / latency)
# Goal: Prefer fast (low latency) nodes → better for web services
# ──────────────────────────────────────────────
def network_aware(nodes, job):
    available = [
        n for n in nodes
        if n["used_cpu"] + job["cpu"] <= n["total_cpu"]
        and n["used_ram"] + job["ram"] <= n["total_ram"]
    ]
    if not available:
        return None

    def score(n):
        free_cpu_ratio = 1 - (n["used_cpu"] / n["total_cpu"])  # 0.0 to 1.0
        latency_score  = 1 / n["latency_ms"]                   # lower latency = higher score
        return 0.6 * free_cpu_ratio + 0.4 * latency_score

    return sorted(available, key=score, reverse=True)[0]


# ──────────────────────────────────────────────
# RUN ONE STRATEGY: Place all 12 jobs, collect results
# ──────────────────────────────────────────────
def run_strategy(strategy_fn, strategy_name):
    nodes = fresh_nodes()
    assignments = []  # Which job went to which node
    total_latency = 0

    for job in JOBS:
        chosen = strategy_fn(nodes, job)
        if chosen:
            chosen["used_cpu"] += job["cpu"]
            chosen["used_ram"] += job["ram"]
            chosen["assigned_jobs"].append(job["id"])
            assignments.append((job["id"], chosen["id"]))
            total_latency += chosen["latency_ms"]

    avg_latency = total_latency / len(assignments) if assignments else 0
    jobs_placed = len(assignments)

    # Node utilization % for each node
    utilizations = {
        n["id"]: round((n["used_cpu"] / n["total_cpu"]) * 100)
        for n in nodes
    }

    # Balance score: how evenly spread are the jobs?
    # 100% = perfectly even, lower = imbalanced
    max_util = max(u for u in utilizations.values())
    balance = round((1 - max_util / 100) * 100)

    return {
        "strategy": strategy_name,
        "assignments": assignments,
        "nodes": nodes,
        "avg_latency_ms": round(avg_latency, 1),
        "jobs_placed": jobs_placed,
        "utilizations": utilizations,
        "balance_score": balance,
    }


# ──────────────────────────────────────────────
# PRINT RESULTS: Show assignment log + comparison table
# ──────────────────────────────────────────────
def print_result(result):
    print(f"\n{'='*50}")
    print(f"  Strategy: {result['strategy']}")
    print(f"{'='*50}")

    print("\n  Assignment log:")
    for job_id, node_id in result["assignments"]:
        print(f"    {job_id:8} → {node_id}")

    print("\n  Node utilization:")
    for node_id, util in result["utilizations"].items():
        bar = "█" * (util // 5) + "░" * (20 - util // 5)
        print(f"    {node_id}: [{bar}] {util}%")

    print(f"\n  Avg latency  : {result['avg_latency_ms']} ms")
    print(f"  Jobs placed  : {result['jobs_placed']}/12")
    print(f"  Balance score: {result['balance_score']}%")


def print_comparison(results):
    print(f"\n\n{'='*50}")
    print("  COMPARISON TABLE")
    print(f"{'='*50}")
    print(f"  {'Strategy':<16} {'Avg Latency':>12} {'Jobs':>6} {'Balance':>9}")
    print(f"  {'-'*16} {'-'*12} {'-'*6} {'-'*9}")
    for r in results:
        print(f"  {r['strategy']:<16} {str(r['avg_latency_ms'])+'ms':>12} {str(r['jobs_placed'])+'/12':>6} {str(r['balance_score'])+'%':>9}")

    print("\n  Node utilization per strategy:")
    print(f"  {'Node':<10}", end="")
    for r in results:
        print(f"  {r['strategy']:<16}", end="")
    print()
    for node in NODES:
        print(f"  {node['id']:<10}", end="")
        for r in results:
            util = r["utilizations"][node["id"]]
            print(f"  {str(util)+'%':<16}", end="")
        print()

    # Winner for each metric
    best_latency = min(results, key=lambda r: r["avg_latency_ms"])
    best_balance = max(results, key=lambda r: r["balance_score"])
    print(f"\n  ✔ Lowest latency  → {best_latency['strategy']} ({best_latency['avg_latency_ms']}ms)")
    print(f"  ✔ Best balance    → {best_balance['strategy']} ({best_balance['balance_score']}%)")
    print()


# ──────────────────────────────────────────────
# MAIN: Run all 3 strategies and compare
# ──────────────────────────────────────────────
if __name__ == "__main__":
    print("\nOS Case Study — Scheduling Strategy Simulator")
    print("3 nodes | 12 jobs | 3 strategies\n")

    strategies = [
        (least_loaded,    "Least-Loaded"),
        (binpack,         "Binpack"),
        (network_aware,   "Network-Aware"),
    ]

    results = []
    for fn, name in strategies:
        result = run_strategy(fn, name)
        print_result(result)
        results.append(result)

    print_comparison(results)
