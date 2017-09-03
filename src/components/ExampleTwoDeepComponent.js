import React, {Component} from 'react'
import PropTypes from 'prop-types';
import { Li } from '../styles/style';
import s from '../styles/exampleTwoDeepComponent.style';
import Avatar from 'material-ui/Avatar';
import SvgIconFace from 'material-ui/svg-icons/av/movie';
import SearchBar from 'material-ui-search-bar'
import Chip from 'material-ui/Chip';


const propTypes = {
  location: PropTypes.object.isRequired,
};


const queryPresent = location.search !== '';

class ExampleTwoDeepComponent extends Component {
    constructor(props) {
        super(props);
        this.state = {
            value: "",
            chipData: [],
            availableShows: [ "Game of Thrones", "Peaky", "Peaky Blinders"]};
        this.styles = {
            chip: {
                margin: 4,
            },
            wrapper: {
                display: 'flex',
                flexWrap: 'wrap',
            },
        };

    }
  _parseQueryString = () => {
    if (!queryPresent) return [];
    return location.search
      .replace('?', '')
      .split('&')
      .map(fvPair => fvPair.split('='))
      .map(pair => [pair[0], pair.slice(1).join('=')]);
  }

  componentDidMount = () => {
      const queryParams = this._parseQueryString()


      for (let key of queryParams) {
          if (key[0] === "shows") {
              const chipData = decodeURIComponent(key[1]).split(",").reduce((result, show) => {
                      if (this.state.availableShows.indexOf(show) > -1) {
                          result.push({"key": show, "label": show})
                      }
                      return result
                  }, []
              )

              console.debug(this.state.chipData, chipData)
              this.setState({chipData})
          }
      }

      console.debug(this.state.chipData)
  }

    handleRequestDelete = (key) => {
        this.chipData = this.state.chipData;
        const chipToDelete = this.chipData.map((chip) => chip.key).indexOf(key);
        this.chipData.splice(chipToDelete, 1);
        this.setState({chipData: this.chipData});
    };

    renderChip(data) {
        return (
            <Chip
                key={data.key}
                onRequestDelete={() => this.handleRequestDelete(data.key)}
                style={this.styles.chip}
            >
                <Avatar color="#444" icon={<SvgIconFace />} />
                {data.label}
            </Chip>
        );
    }

    _handleSearchChange = (value) => {
        this.setState({value})
        if (this.state.availableShows.indexOf(value) > -1) {
            const chipData = this.state.chipData.concat([{key: value, label: value}])
            this.setState({chipData})
            this.setState({value: ""})
            console.debug(this.state.chipData)
        }
    }

    render() {
      return (
        <div>
            <SearchBar
                hintText="Add shows to compare"
                dataSource={this.state.availableShows}
                onChange={(value) => this._handleSearchChange(value)}
                onRequestSearch={() => console.log('onRequestSearch')}
                value={this.state.value}
                style={{
                    margin: '2em auto',
                    maxWidth: 800
                }}
            />
            <div style={this.styles.wrapper}>
                {this.state.chipData.map(this.renderChip, this)}
            </div>
        </div>
    );
  }
}

ExampleTwoDeepComponent.propTypes = propTypes;
export default ExampleTwoDeepComponent;