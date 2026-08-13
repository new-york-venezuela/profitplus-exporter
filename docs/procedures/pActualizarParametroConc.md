# SP: pActualizarParametroConc
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saParametroConc`](../tables/saParametroConc.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizarParametroConc
*AUTOR			: Softech Sistemas
**************************************************************************/

CREATE PROCEDURE [pActualizarParametroConc]
    (
      @sCo_Conf CHAR(6) ,
      @sCo_ConfOri CHAR(6) ,
      @sDes_Conf VARCHAR(60) ,
      @sCo_Ban CHAR(6) ,
      @sCo_BanOri CHAR(6) ,
      @bOpc_Doc BIT ,
      @iConc_Parcial INT ,
      @iCantidadDig INT ,
      @bOpc_Fec BIT ,
      @iMargenInf INT ,
      @iMargenSup INT ,
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
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		
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
            [saParametroConc]
        SET [co_conf] = @sCo_Conf, [des_conf] = @sDes_Conf, [co_ban] = @sCo_Ban, [opc_doc] = @bOpc_Doc,
            [conc_parcial] = @iConc_Parcial, [cantidadDig] = @iCantidadDig, [opc_fec] = @bOpc_Fec,
            [margenInf] = @iMargenInf, [margenSup] = @iMargenSup, [campo1] = @sCampo1, [campo2] = @sCampo2,
            [campo3] = @sCampo3, [campo4] = @sCampo4, [campo5] = @sCampo5, [campo6] = @sCampo6, [campo7] = @sCampo7,
            [campo8] = @sCampo8, [co_us_mo] = @sCo_Us_Mo, [co_sucu_mo] = @sCo_Sucu_Mo, [fe_us_mo] = GETDATE(),
            [revisado] = @sRevisado, [trasnfe] = @sTrasnfe
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_conf = @sCo_ConfOri
            AND co_ban = @sCo_BanOri
            AND validador = @tsValidador

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
```
