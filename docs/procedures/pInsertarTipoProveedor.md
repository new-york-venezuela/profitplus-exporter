# SP: pInsertarTipoProveedor
**Tipo**: Insertar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saTipoProveedor`](../tables/saTipoProveedor.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pInsertarTipo_Pro 
*DESCRIPCIÓN	:	Inserta un registro en la tabla  tipo_pro
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pInsertarTipoProveedor]
    (
      @sTip_Pro CHAR(6) ,
      @sDes_Tipo VARCHAR(60) ,
	--@sCo_Sucu		CHAR(6),
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)
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
		
        INSERT  INTO saTipoProveedor
                ( tip_pro, des_tipo, --co_sucu, 
                  campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8, co_us_in, fe_us_in, co_us_mo, fe_us_mo,
                  revisado, trasnfe, co_sucu_in, co_sucu_mo )
        OUTPUT  Inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sTip_Pro, @sDes_Tipo, --@sCo_sucu, 
                  @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6, @sCampo7, @sCampo8, @sCo_Us_In, GETDATE(),
                  @sCo_Us_In, GETDATE(), @sRevisado, @sTrasnfe, @sCo_Sucu_In, @sCo_Sucu_In )
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saTipoProveedor', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sTip_Pro
		
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```
