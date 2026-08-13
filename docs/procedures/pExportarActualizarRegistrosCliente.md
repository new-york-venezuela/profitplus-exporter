# SP: pExportarActualizarRegistrosCliente
**Tipo**: Procedimiento
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCliente`](../tables/saCliente.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarRegistrosCliente
*DESCRIPCIÓN	:	Inserta un Cliente
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [dbo].[pExportarActualizarRegistrosCliente]
    (
      @sCo_Cli			CHAR(16) ,
      @sCo_CliOri		CHAR(16) ,
      @sLogin			CHAR(10) = NULL ,
      @sPassword		CHAR(50) = NULL ,
      @sSalesTax		CHAR(8) = NULL ,
      @sCli_Des			VARCHAR(100) ,
      @sCo_seg			CHAR(6) ,
      @sCo_zon			CHAR(6) ,
      @sCo_Ven			CHAR(6) ,
      @sEstado			CHAR(1) = NULL ,
      @bInactivo		BIT = 0 ,
      @bValido			BIT = 0 ,
      @bSinCredito		BIT = 0 ,
      @bLunes			BIT = 0 ,
      @bMartes			BIT = 0 ,
      @bMiercoles		BIT = 0 ,
      @bJueves			BIT = 0 ,
      @bViernes			BIT = 0 ,
      @bSabado			BIT = 0 ,
      @bDomingo			BIT = 0 ,
      @sDirec1			VARCHAR(MAX) = NULL ,
      @sDirec2			VARCHAR(MAX) = NULL ,
      @sDir_Ent2		VARCHAR(MAX) = NULL ,
      @sHorar_Caja		VARCHAR(60) = NULL ,
      @sFrecu_Vist		VARCHAR(60) = NULL ,
      @sTelefonos		VARCHAR(60) = NULL ,
      @sFax				VARCHAR(60) = NULL ,
      @sRespons			VARCHAR(60) = NULL ,
      @sdFecha_reg		SMALLDATETIME ,
      @sTip_Cli			CHAR(6) ,
      @sSerialP			CHAR(30) = NULL ,
      @iPuntaje			INT = NULL ,
      @iId				INT = NULL ,
      @deMont_cre		DECIMAL(18, 2) = NULL ,
      @sCo_mone			CHAR(6) = NULL ,
      @sCond_Pag		CHAR(6) = NULL ,
      @iPlaz_pag		INT = NULL ,
      @deDesc_ppago		DECIMAL(18, 2) = NULL ,
      @deDesc_Glob		DECIMAL(18, 2) = NULL ,
      @sTipo_Iva		CHAR(1) = NULL ,
      @deIva			DECIMAL(18, 2) = NULL ,
      @sRif				VARCHAR(18) = NULL ,
      @bContrib			BIT = 0 ,
      @sDis_cen			VARCHAR(MAX) = NULL ,
      @sNit				VARCHAR(18) = NULL ,
      @sEmail			VARCHAR(60) = NULL ,
      @sCo_Cta_Ingr_Egr CHAR(20) ,
      @sComentario		VARCHAR(MAX) = NULL ,
      @bJuridico		BIT = 0 ,
      @iTipo_Adi		INT = NULL ,
      @sMatriz			CHAR(16) = NULL ,
      @sCo_Tab			CHAR(20) = NULL ,
      @sTipo_Per		CHAR(1) = NULL ,
      @sCo_pais			CHAR(6) = NULL ,
      @sCiudad			VARCHAR(50) = NULL ,
      @sZip				VARCHAR(10) = NULL ,
      @sWebSite			VARCHAR(200) = NULL ,
      @bContribu_E		BIT = 0 ,
      @bRete_Regis_Doc	BIT ,
      @dePorc_Esp		DECIMAL(18, 2) = NULL,
	  @sCampo1			VARCHAR(60)			= NULL ,
      @sCampo2			VARCHAR(60)			= NU
```
