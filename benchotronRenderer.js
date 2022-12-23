window.BenchotronRenderer = {};
(function () {
  const margin = { top: 40, right: 40, bottom: 40, left: 80 };
  const width = 880;
  const height = 400;
  const footerHeight = 60;
  const totalHeight = margin.top + height + footerHeight + margin.bottom;
  const totalWidth = margin.left + width + margin.right;
  const gap = 10;

  const x = d3.scale.linear()
    .range([0, width]);

  const y = d3.scale.linear()
    .range([height, 0]);

  const xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

  const yAxis = d3.svg.axis()
    .scale(y)
    .orient("left")
    .tickFormat((d) => {
      const scientific = d3.format('0.2e')
      const fixed = d3.format('0.2f')
      return d <= 0.01 ? scientific(d) : fixed(d);
    });

  const line = d3.svg.line()
    .x((d) => x(d.size))
    .y((d) => y(d.stats.mean));

  function takeWhere(arr, pred) {
    const result = arr.filter(pred);
    if (result.length === 1) {
      return result[0];
    } else {
      throw new Error('takeWhere: did not return exactly 1 result');
    }
  }

  function dataSeriesClass(seriesIndex, seriesLength) {
    return `data-series-${String(seriesIndex)} data-series-count-${String(seriesLength)}`;
  }

  function renderSeries(svg, seriesIndex, seriesLength, data) {
    const series = svg.append("g")
      .attr("class", dataSeriesClass(seriesIndex, seriesLength));

    series.selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d) => x(d.size))
      .attr("cy", (d) => y(d.stats.mean))
      .attr("r", 3);

    series.selectAll("path.error-bar")
      .data(data)
      .enter()
      .append("path")
      .attr("class", "error-bar")
      .attr("x", (d) => x(d.size))
      .attr("y", (d) => y(d.stats.mean))
      .attr("d", function (d) {
        const mx = x(d.size);
        const my = y(d.stats.mean);
        const my1 = y(d.stats.mean + d.stats.deviation);
        const my2 = y(d.stats.mean - d.stats.deviation);
        const dx = 3;
        return ["M", mx, my,
          "V", my1, "h", -dx, "h", 2 * dx, "h", -dx,
          "V", my2, "h", -dx, "h", 2 * dx
        ].join(' ');
      })

    series.append("path")
      .datum(data)
      .attr("class", "line")
      .attr("d", line);
  }

  function concatArray(x, y) {
    return x.concat(y);
  }

  function arrContains(arr, x) {
    return arr.indexOf(x) !== -1;
  }

  function taggedResults(data) {
    const tags = [...data.series.reduce((acc, next) => {
      return next.tags.reduce((acc2, tag) => {
        acc2.add(tag);
        return acc2;
      }, acc);
    }, new Set())];
    return tags.reduce((acc, nextTag) => {
      acc.push({
        ...data,
        series: data.series.filter((x) => arrContains(x.tags, nextTag)),
        tag: nextTag,
      })
      return acc;
    }, []);
  }

  function renderBenchmark(graphArea, data) {
    const chartArea = graphArea.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Compute appropriate scales
    const allData = data.series
      .map((x) => x.results)
      .reduce(concatArray, []); // flatten

    x.domain(d3.extent(allData, (d) => d.size));
    y.domain(d3.extent(allData, (d) => d.stats.mean));

    // Draw title
    const titleArea = chartArea.append("g")
      .attr("transform", `translate(${width / 2}, 0)`);
    titleArea.append("text")
      .style("text-anchor", "middle")
      .style("font-size", "28px")
      .text(data.tag ? data.title + "*" : data.title);

    if (data.tag) {
      titleArea.append("text")
        .attr("y", 20)
        .style("text-anchor", "middle")
        .style("font-size", "16px")
        .text(`* Tag: ${data.tag}`);
    }

    // Draw x axis
    chartArea.append("g")
      .attr("class", "x axis")
      .attr("transform", `translate(0, ${height})`)
      .call(xAxis)
      .append("text")
      .attr("x", width / 2)
      .attr("y", 40)
      .style("text-anchor", "middle")
      .text(data.sizeInterpretation);

    // Draw y axis
    chartArea.append("g")
      .attr("class", "y axis")
      .call(yAxis)
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Mean running time (seconds)");

    // HACK: Apply some classes for styling, since apparently lots of SVG
    // software can't cope with anything other than the most basic selectors
    chartArea.selectAll('.axis line')
      .attr('class', 'axis-line');

    chartArea.selectAll('.axis path')
      .attr('class', 'axis-path');

    // Plot each data series
    data.series.forEach((d, index) => renderSeries(chartArea, index, data.series.length, d.results));

    // Draw legend
    const legend = chartArea.append("g")
      .attr("class", "legend")
      .attr("transform", "translate(50, 50)");

    const legendData = data.series.map((d) => d.name);
    legend.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (_, i) => i * 20)
      .attr("width", 15)
      .attr("height", 15)
      .attr("class", (_, i) => dataSeriesClass(i, data.series.length));

    legend.selectAll("text")
      .data(legendData)
      .enter()
      .append("text")
      .attr("x", 24)
      .attr("y", (_, i) => i * 20 + 13)
      .text((d) => d);

    // Draw RFC3339 Date
    const benchDate = [
      [
        data.dateRfc3339.slice(0, 4),
        data.dateRfc3339.slice(5, 7),
        data.dateRfc3339.slice(8, 10)
      ].join("-"),
      " ",
      [
        data.dateRfc3339.slice(11, 13),
        data.dateRfc3339.slice(14, 16),
        data.dateRfc3339.slice(17, 19)
      ].join(":"),
    ].join("");

    const benchDateGroup = graphArea.append("g")
      .attr("transform", `translate(${margin.left + width}, ${margin.top + height + footerHeight})`)
      .attr("class", "graph-footer");
    benchDateGroup.append("text")
      .style("text-anchor", "end")
      .text(`Ran on:`);
    benchDateGroup.append("text")
      .style("text-anchor", "end")
      .attr("y", 14)
      .text(`${benchDate}`);
  }

  function drawGraph(data, elId) {
    // Delete the old graph
    d3.select(elId + " svg").remove();

    // Create the new graph
    const svg = d3.select(elId).append("svg");

    // Add the styles
    const styleText = d3.select("#svg-styles").text();
    d3.select(elId + " svg")
      .append("defs")
      .append("style")
      .attr("type", "text/css")
      .text(styleText);

    const taggedData = taggedResults(data);
    const numOfGraphs = 1 + taggedData.length;
    const svgHeight = totalHeight * numOfGraphs + gap * (numOfGraphs - 1);

    // Prepare the graph
    svg.attr("width", totalWidth)
      .attr("height", svgHeight);
    svg.append("rect")
      .attr("width", totalWidth)
      .attr("height", svgHeight)
      .attr("class", "background");

    const graphArea1 = svg.append("g")
      .attr("transform", `translate(0, ${(totalHeight * 0) + (gap * 0)})`);

    renderBenchmark(graphArea1, data);

    taggedData.forEach((newData, idx) => {
      svg.append("line")
        .attr("x1", 0)
        .attr("y1", (totalHeight * (idx + 1) + (gap * idx) + gap / 2))
        .attr("x2", totalWidth)
        .attr("y2", (totalHeight * (idx + 1) + (gap * idx) + gap / 2))
        .attr("class", "graph-gap-line");

      const taggedGraphArea = svg.append("g")
        .attr("transform", `translate(0, ${(totalHeight * (idx + 1)) + (gap * (idx + 1))})`);

      renderBenchmark(taggedGraphArea, newData);
    });
  }

  window.BenchotronRenderer.drawGraph = drawGraph;
})();
