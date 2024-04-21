document.getElementById('back-home').addEventListener('click', function () {
  window.location.href = '/';
});

// Load data from CSV
d3.csv("/exam_topics.csv")
  .then(function (data) {
    // Sort the data based on study time in descending order
    data.sort(function (a, b) {
      return parseInt(b['Study Time (minutes)']) - parseInt(a['Study Time (minutes)']);
    });

    // Assign rank to each topic based on the sorted order
    data.forEach(function (d, i) {
      d.rank = i + 1;
    });

    // Get the dimensions of the graph div
    var graphRect = d3.select("#graph").node().getBoundingClientRect();
    var graphWidth = graphRect.width;
    var graphHeight = graphRect.height;
    var radius = 20;

    // Create a force-directed graph
    var simulation = d3.forceSimulation(data)
      .force("charge", d3.forceManyBody().strength(-35))
      .force("center", d3.forceCenter(graphWidth / 2, graphHeight / 2))
      .force("collision", d3.forceCollide().radius(function (d) {
        return radius * (parseInt(d['Study Time (minutes)']) / 50);
      }))
      .on("tick", ticked);

    var svg = d3.select("#graph")
      .append("svg")
      .attr("width", graphWidth)
      .attr("height", graphHeight);

    // Create nodes
    var node = svg.append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(data)
      .enter().append("circle")
      .attr("class", "node")
      .attr("r", function (d) { return radius * (parseInt(d['Study Time (minutes)']) / 50 + 1); })
      .call(drag(simulation));

    // Add node labels
    var text = svg.append("g")
      .attr("class", "texts")
      .selectAll("text")
      .data(data)
      .enter().append("text")
      .attr("dx", 0) // Center the text horizontally
      .attr("dy", ".35em")
      .text(function (d) { return d.rank; }) // Use the rank as the text inside the node
      .attr("text-anchor", "middle"); // Center the text horizontally

    // Add mouseover event to nodes
    node.on("mouseover", function (event, d) {
      d3.select("#topic-name").text("Topic: " + d.Topic);
      d3.select("#topic-time").text("Study Time: " + d['Study Time (minutes)'] + " minutes");
      d3.select("#topic-percentage").text("Exam Percentage: " + d['Exam Percentage']);
      d3.select("#topic-rank").text("Rank: " + d.rank);
      d3.select("#topic-description").text("Description: " + d.Description); // Display the description
    });

    // Add mouseout event to nodes
    node.on("mouseout", function (event, d) {
      d3.select("#topic-name").text("");
      d3.select("#topic-time").text("");
      d3.select("#topic-percentage").text("");
      d3.select("#topic-rank").text("");
      d3.select("#topic-description").text(""); // Clear the description
    });

    // Add zoom and pan functionality
    var zoom = d3.zoom()
      .scaleExtent([0.5, 10])
      .on("zoom", zoomed);

    svg.call(zoom);

    function zoomed(event) {
      node.attr("transform", event.transform);
      text.attr("transform", event.transform);
    }

    // Implement search or filter functionality
    d3.select("#search-input")
      .on("input", function () {
        var searchTerm = this.value.toLowerCase();
        node.classed("hidden", function (d) {
          return d.Topic.toLowerCase().indexOf(searchTerm) === -1;
        });
        text.classed("hidden", function (d) {
          return d.Topic.toLowerCase().indexOf(searchTerm) === -1;
        });
      });

    // Update positions on simulation tick
    function ticked() {
      node
        .attr("cx", function (d) { return d.x; })
        .attr("cy", function (d) { return d.y; });

      text
        .attr("x", function (d) { return d.x; })
        .attr("y", function (d) { return d.y; });

      // Keep nodes within the graph boundaries
      node.attr("cx", function (d) { return Math.max(radius, Math.min(graphWidth - radius, d.x)); })
        .attr("cy", function (d) { return Math.max(radius, Math.min(graphHeight - radius, d.y)); });
    }

    // Drag behavior for nodes
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event) {
        var newX = event.x;
        var newY = event.y;

        // Calculate the radius of the node
        var nodeRadius = parseFloat(d3.select(this).attr("r"));

        // Constrain the node position within the graph boundaries
        newX = Math.max(nodeRadius, Math.min(newX, graphWidth - nodeRadius));
        newY = Math.max(nodeRadius, Math.min(newY, graphHeight - nodeRadius));

        event.subject.fx = newX;
        event.subject.fy = newY;
      }

      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
  })
  .catch(function (error) {
    // Handle error loading CSV data
    console.error("Error loading CSV data:", error);
    // Display an error message to the user
    d3.select("#graph")
      .html('<div class="error-message">Failed to load exam topics data. Please try again later.</div>');
  });