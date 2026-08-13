# SP: pActualizarRenglonesDepositoBanco
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDepositoBancoReng`](../tables/saDepositoBancoReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pActualizarRenglonesDepositoBanco
DESCRIPCION	: Actualiza un registro de la tabla saDepositoBancoReng
DATE CREATE : <2011-12-12>
UPDATE DATE : <2019-09-30>
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarRenglonesDepositoBanco]
    (
      @sDep_Num CHAR(20) ,
      @iReng_Num INT ,
      @sDep_NumOri CHAR(20) ,
      @iReng_NumOri INT ,
      @sCodigo CHAR(6) ,
      @sMov_Afec_c CHAR(20) ,
      @sMov_Gene_c CHAR(20) ,
      @deMonto DECIMAL(18, 2) ,
      @deComision DECIMAL(18, 5) ,
      @deImpuesto DECIMAL(18, 5) ,
      @sTipo_Plazo CHAR(1) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
	
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saDepositoBancoReng
        SET dep_num = @sDep_Num, reng_num = @iReng_Num, codigo = @sCodigo, mov_afec_c = @sMov_Afec_c,
            mov_gene_c = @sMov_Gene_c, monto = @deMonto, comision = ((@deMonto * @deComision)/100), impuesto = dbo.CalcularImpuestoTarjetas(@sMov_Afec_c, @deMonto, @deImpuesto),
            tipo_plazo = @sTipo_Plazo, co_sucu_mo = @sCo_Sucu_Mo, co_us_mo = @sCo_Us_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            dep_num = @sDep_NumOri
            AND reng_num = @iReng_NumOri
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saDepositoBancoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sCampos
	
        SELECT
```
