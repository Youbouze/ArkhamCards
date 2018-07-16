import React from 'react';
import PropTypes from 'prop-types';
import { find, flatMap, keys, map } from 'lodash';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { CUSTOM } from '../constants';
import ChaosBagSection from '../ChaosBagSection';
import CampaignNotesSection from '../CampaignNotesSection';
import DecksSection from '../DecksSection';
import InvestigatorStatusRow from './InvestigatorStatusRow';
import Button from '../../core/Button';
import { updateCampaign, deleteCampaign } from '../actions';
import { getCampaign, getAllDecks, getAllPacks } from '../../../reducers';
import typography from '../../../styles/typography';

class CampaignDetailView extends React.Component {
  static propTypes = {
    navigator: PropTypes.object.isRequired,
    id: PropTypes.number.isRequired,
    // redux
    updateCampaign: PropTypes.func.isRequired,
    deleteCampaign: PropTypes.func.isRequired,
    campaign: PropTypes.object,
    decks: PropTypes.object,
    scenarioPack: PropTypes.object,
  };

  constructor(props) {
    super(props);

    this._updateLatestDeckIds = this.applyCampaignUpdate.bind(this, 'latestDeckIds');
    this._updateChaosBag = this.applyCampaignUpdate.bind(this, 'chaosBag');
    this._updateCampaignNotes = this.applyCampaignUpdate.bind(this, 'campaignNotes');
    this._deletePressed = this.deletePressed.bind(this);
    this._delete = this.delete.bind(this);
    this._addScenarioResult = this.addScenarioResult.bind(this);
  }

  applyCampaignUpdate(key, value) {
    const {
      campaign,
      updateCampaign,
    } = this.props;
    updateCampaign(campaign.id, { [key]: value });
  }

  componentDidUpdate(prevProps) {
    const {
      campaign,
      navigator,
    } = this.props;
    if (campaign && prevProps.campaign && campaign.name !== prevProps.campaign.name) {
      navigator.setSubTitle({ subtitle: campaign.name });
    }
  }

  updateChaosBag(bag) {
    this.setState({
      chaosBag: bag,
    });
  }

  deletePressed() {
    const {
      campaign,
    } = this.props;
    Alert.alert(
      'Delete',
      `Are you sure you want to delete the campaign: ${campaign.name}?`,
      [
        { text: 'Delete', onPress: this._delete, style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  delete() {
    const {
      id,
      deleteCampaign,
      navigator,
    } = this.props;
    deleteCampaign(id);
    navigator.pop();
  }

  addScenarioResult() {
    const {
      campaign,
      navigator,
    } = this.props;
    navigator.push({
      screen: 'Campaign.AddResult',
      passProps: {
        campaign,
      },
      backButtonTitle: 'Cancel',
    });
  }

  renderScenarioResults() {
    const {
      campaign: {
        investigatorStatus,
      },
    } = this.props;
    return (
      <View>
        { map(keys(investigatorStatus), code => (
          <InvestigatorStatusRow
            key={code}
            investigatorCode={code}
            status={investigatorStatus[code]}
          />
        )) }
      </View>
    );
  }

  renderLatestDecks() {
    const {
      navigator,
      campaign,
    } = this.props;
    return (
      <DecksSection
        navigator={navigator}
        campaign={campaign}
        updateLatestDeckIds={this._updateLatestDeckIds}
      />
    );
  }

  investigators() {
    const {
      decks,
      campaign: {
        latestDeckIds,
      },
    } = this.props;
    return map(
      flatMap(latestDeckIds, deckId => decks[deckId]),
      deck => deck.investigator_code);
  }

  render() {
    const {
      navigator,
      campaign,
      scenarioPack,
    } = this.props;
    if (!campaign) {
      return null;
    }
    return (
      <ScrollView>
        <Text style={[typography.bigLabel, styles.margin]}>
          { campaign.name }
        </Text>
        { campaign.cycleCode !== CUSTOM && (
          <Text style={[typography.text, styles.margin]}>
            { scenarioPack.name }
          </Text>
        ) }
        { this.renderScenarioResults() }
        <Button onPress={this._addScenarioResult} text="Record Scenario Result" />
        { this.renderLatestDecks() }
        <ChaosBagSection
          navigator={navigator}
          chaosBag={campaign.chaosBag}
          updateChaosBag={this._updateChaosBag}
        />
        <CampaignNotesSection
          navigator={navigator}
          campaignNotes={campaign.campaignNotes}
          investigators={this.investigators()}
          updateCampaignNotes={this._updateCampaignNotes}
        />
        <View style={styles.margin}>
          <Button color="red" onPress={this._deletePressed} text="Delete Campaign" />
        </View>
        <View style={styles.footer} />
      </ScrollView>
    );
  }
}

function mapStateToProps(state, props) {
  const campaign = getCampaign(state, props.id);
  const packs = getAllPacks(state);
  return {
    campaign: campaign,
    decks: getAllDecks(state),
    scenarioPack: campaign && find(packs, pack => pack.code === campaign.cycleCode),
    packs: packs,
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({
    deleteCampaign,
    updateCampaign,
  }, dispatch);
}

export default connect(mapStateToProps, mapDispatchToProps)(CampaignDetailView);

const styles = StyleSheet.create({
  margin: {
    margin: 8,
  },
  footer: {
    height: 100,
  },
});
