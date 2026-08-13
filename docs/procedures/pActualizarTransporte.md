# SP: pActualizarTransporte
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saTransporte`](../tables/saTransporte.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarTransporte
*DESCRIPCIÓN	: Actualiza un transporte
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarTransporte]
    (
      @sCo_Tran CHAR(6) ,
      @sCo_TranOri CHAR(6) ,
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
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
	  @sidentificador_1 VARCHAR(100),
	   @sidentificador_2 VARCHAR(100),
	    @sidentificador_3 VARCHAR(100),
		 @sident_responsable VARCHAR(100),

		  @sColorTransp VARCHAR(100),
		 @sTelefono VARCHAR(100),
		 @scontacto VARCHAR(100),
		 @sNomApelCond VARCHAR(200),
		 @sIdentificadorCond VARCHAR(100),
		 @sContactoCond VARCHAR(100),
		 @stipoLicCond VARCHAR(30),
		 @sclasificacion VARCHAR(1),
		 @itipoIdRespon int,
		 @itipoIdCond int

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

        UPDATE
            saTransporte
        SET co_tran = @sCo_Tran, des_tran = @sDes_Tran, resp_tra = @sResp_Tra, dis_cen = @sDis_Cen, campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe, identificador_1 = @sidentificador_1, identificador_2 = @sidentificador_2,
			identificador_3 = @sidentificador_3, ident_responsable=@sident_responsable,
			colorTransp=@sColorTransp,telefono=@sTelefono,contacto=@scontacto,nomApelCond=@sNomApelCond,identificadorCond=@sIdentificadorCond,
			contactoCond=
```
