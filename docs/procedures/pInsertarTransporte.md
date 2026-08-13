# SP: pInsertarTransporte
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saTransporte`](../tables/saTransporte.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pInsertarTransporte
*DESCRIPCIÓN	: Inserta un Transporte
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarTransporte]
    (
      @sCo_Tran CHAR(6) ,
      @sDes_Tran VARCHAR(60) ,
      @sResp_Tra VARCHAR(60) ,
      @sDis_Cen VARCHAR(MAX)= NULL ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1),
	  @sidentificador_1 VARCHAR(100)= NULL ,
	  @sidentificador_2 VARCHAR(100)= NULL ,
	  @sidentificador_3 VARCHAR(100)= NULL ,
	  @sident_responsable VARCHAR(100)= NULL ,
	  
	  @sColorTransp VARCHAR(100)= NULL ,
	  @sTelefono VARCHAR(100)= NULL ,
	  @scontacto VARCHAR(100)= NULL ,
	  @sNomApelCond VARCHAR(200)= NULL ,
	  @sIdentificadorCond VARCHAR(100)= NULL ,
	  @sContactoCond VARCHAR(100)= NULL ,
	  @stipoLicCond VARCHAR(30)= NULL ,
	  @sclasificacion VARCHAR(1)= NULL ,
	  @itipoIdRespon int= NULL ,
	  @itipoIdCond int= NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saTransporte
                ( co_tran, des_tran, resp_tra, dis_cen, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe,
				  identificador_1,identificador_2,identificador_3,ident_responsable,
				  colorTransp,telefono,contacto,nomApelCond,identificadorCond,contactoCond,tipoLicCond,clasificacion,tipoIdRespon,tipoIdCond)
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Tran, @sDes_Tran, @sResp_Tra, @sDis_Cen, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5,
                  @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_
```
